import * as path from 'path';
import {exec} from 'child-process-promise';
import {readdirSync, statSync, writeFileSync} from 'fs';
import * as glob from 'glob-promise';
import * as _ from 'lodash';
import slugify from 'slugify';

const sequential = require('promise-sequential');

const commands = {
    copyFolderStructure: (to: string, targetName): string =>
        `cd '${to}' && rm -rf "../${targetName}" && find . -type d ! -path "**/gif*" -exec mkdir -p "../${targetName}/{}" \\;`,

    mkdir: (dirPath: string): string =>
        `rm -rf '${dirPath}' && mkdir '${dirPath}'`,

    removeFiles: (pattern: string): string =>
        `rm -rf ${pattern}`,

    generateThumbnail: (filePath: string, targetDir: string): string =>
        `qlmanage -t -s 1600x800  -o '${targetDir}' '${filePath}'`,

    resize: (filePath: string, size: string | null, to: string) =>
        `convert -flatten${size ? ` -resize ${size} ` : ' '}'${filePath}' '${to}'`,

    fileInfo: (filePath: string) =>
        `magick identify '${filePath}'`,

    extractPages: (filePath: string, dirPath: string, prefix: string) =>
        `convert -density 150 '${filePath}' '${path.join(dirPath, prefix)}-%0d.png'`,

    generateGif: (framesPattern: string, gifname: string) =>
        `convert -delay 10 -loop 0 -resize 600x '${framesPattern}' '${gifname}.gif'`,

    copy: (fromPath: string, toString) =>
        `cp -a ${fromPath} ${toString}`
};


enum FileOrientation {
    HORIZONTAL = 'HORIZONTAL',
    VERTICAL = 'VERTICAL'
}

interface FileInfo {
    format: string,
    width: number,
    height: number,
    orientation: string,
    layers: number
}


const parseFileInfo = (filePath: string, infoRaw: string): FileInfo => {
    //if it is multiple layers
    const layers = infoRaw.trim().split('\n');

    //we only create file info based on first layer
    //for files with one layer we remove file name from the line
    //just to be safe against weird file names including white spaces and spacial chars
    const filename = path.basename(filePath);

    const line = layers.length > 1 ?
        layers[0].replace(`${filename}[0]`, '')
        :
        layers[0].replace(filename, '');


    const parts = line.split(' ');
    const dimension = parts[2].split('x');
    const width = parseInt(dimension[0]);
    const height = parseInt(dimension[1]);
    const orientation = width >= height ? FileOrientation.HORIZONTAL : FileOrientation.VERTICAL;

    return {
        format: parts[1],
        width,
        height,
        orientation,
        layers: layers.length
    }
};

const executeCommand = async (cmd): Promise<string> => {
    console.log(`EXECUTING ${cmd}`);
    try {
        const {stdout} = await exec(cmd);
        return stdout
    } catch (err) {
        console.log(`ERROR EXECUTING ${cmd}`);
        console.log(err);
    }
};

const getFileInfo = async (filePath: string): Promise<FileInfo> => {
    const stdout: string = await executeCommand(commands.fileInfo(filePath));
    return parseFileInfo(filePath, stdout);
};


const FileExtensions = {
    JPG: '.jpg',
    JPEG: '.jpeg',
    PNG: '.png',
    TIFF: '.tif',
    PSD: '.psd',
    AI: '.ai',
    PDF: '.pdf',
    PAGE: '.page',
    TXT: '.txt',
    MARKDOWN: '.markdown',
    CSV: '.csv',
    HTML: '.html',
    XLSX: '.xlsx',
    MD: '.md',
    MPEG4: '.mpeg4',
    MP3: '.mp3',
    MOV: '.mov',
};


const SupportedExtensions = {
    IMAGE: [
        FileExtensions.AI,
        FileExtensions.JPEG,
        FileExtensions.JPG,
        FileExtensions.PDF,
        FileExtensions.PNG,
        FileExtensions.TIFF,
        FileExtensions.PSD
    ],
    VIDEO: [
        FileExtensions.MOV,
        FileExtensions.MPEG4
    ],
    TEXT: [
        FileExtensions.TXT,
        FileExtensions.MD,
        FileExtensions.MARKDOWN,
        FileExtensions.HTML,
        FileExtensions.CSV,
        FileExtensions.XLSX
    ]
};


const defaults = {
    maxImageWidth: 1600,
    maxImageHeight: 1200
};


const getFileExtName = (filePath: string): string => path.extname(filePath).toLowerCase();

const createResizeQuery = (info: FileInfo) => {
    if (info.orientation === FileOrientation.HORIZONTAL) {
        return `${defaults.maxImageWidth}x`;
    }
    return `x${defaults.maxImageHeight}`;
};

interface ResponsiveSize {
    [index: string]: number;

    '0x': number;
    '1x': number;
    '2x': number;
}

interface ResponsiveQuery {
    sizename: string;
    query: string;
}

const createResponsiveResizeQuery = (info: FileInfo): ResponsiveQuery[] => {

    const originalWidth = info.width;
    let maxWidth = info.orientation === FileOrientation.HORIZONTAL ?
        Math.min(originalWidth, defaults.maxImageWidth)
        :
        Math.min(originalWidth, defaults.maxImageHeight);

    if(info.format.toLowerCase() === "ai"){
        maxWidth = info.orientation === FileOrientation.HORIZONTAL? defaults.maxImageWidth: defaults.maxImageHeight
    }

    const sizes = {
        "0x": 200,
        "1x": Math.floor(maxWidth/2),
        "2x": Math.floor(maxWidth)
    };

    return Object.keys(sizes)
        .map(sizename => ({
            sizename,
            query: info.orientation === FileOrientation.HORIZONTAL? `${sizes[sizename]}x`: `x${sizes[sizename]}`
        }));
};

const createResponsiveImages = async (fromPath: string, destPath, info: FileInfo) => {
    const sizes = createResponsiveResizeQuery(info);
    const ext = getFileExtName(destPath);

    return sequential(
        sizes.map(size => async () => {
            const resizeFileName = `${path.basename(destPath, ext)}-${size.sizename}${ext}`;
            const dirPath = path.dirname(destPath);
            const resizeFilePath = path.join(dirPath, resizeFileName);
            await executeCommand(commands.resize(fromPath, size.query, resizeFilePath))
        })
    );
};


const imagesDefaultHandler = async (filePath: string, info: FileInfo, to: string) => {
    if (
        (info.orientation === FileOrientation.HORIZONTAL && info.width <= defaults.maxImageWidth)
        ||
        (info.orientation === FileOrientation.VERTICAL && info.height <= defaults.maxImageHeight)
    ) {
        return executeCommand(commands.resize(filePath, null, to));
    }

    const resize = createResizeQuery(info);
    return executeCommand(commands.resize(filePath, resize, to));
};

const extractPagesFromPdfOrAi = async (filename: string,
                                       ext: string,
                                       filePath: string,
                                       dirname: string,
                                       convertedFileDir: string,
                                       info: FileInfo) => {
    const dirpath = path.dirname(filePath);
    const slug = `${ext.replace('.', '')}-${slugify(filename)}`.toLowerCase();
    const extractedImagesPattern = path.join(dirpath, `${slug}-*.png`);

    await executeCommand(commands.extractPages(filePath, dirpath, slug));
    const allPages = await glob.promise(extractedImagesPattern);

    await sequential(
        allPages.map((pagePath) => {
            const convertedFilePath = path.join(convertedFileDir, path.basename(pagePath).toLowerCase());
            return async () =>
                // imagesDefaultHandler(pagePath, info, convertedFilePath);
                createResponsiveImages(pagePath, convertedFilePath, info)
        })
    );

    await executeCommand(commands.removeFiles(extractedImagesPattern));
    return slug
};

export const convertDir = async (rootDir) => {
    const convertFolderName = `${path.basename(rootDir)}-converted`;
    const root = path.dirname(rootDir);
    const outputDir = path.join(root, convertFolderName);

    const createConvertFilePath = (filePath: string): string => {
        return filePath.replace(rootDir, outputDir);
    };

    const createFileData = (metadata, dirname) => (filename) => ({
        filename,
        dirname,
        metadata
    });

    // copy folder structure
    await executeCommand(commands.copyFolderStructure(rootDir, convertFolderName));

    const dir = await glob.promise(`${rootDir}/**/*`);
    const gifs = await glob.promise(path.join(rootDir, '**/gif*/'));

    const files = _.groupBy(dir, (filePath) => {
        const relPath = path.relative(rootDir, filePath);
        const dirname = path.basename(path.dirname(filePath));
        return dirname.startsWith('gif') ?
            path.dirname(relPath).replace('/', '_') : 'rest'
    });


    let data = await sequential(
        files.rest.map(
            (filePath: string) =>
                async () => {
                    const ext = getFileExtName(filePath);
                    const basename = path.basename(filePath);
                    const filename = path.basename(filePath, ext);
                    const dirpath = path.dirname(filePath);
                    const dirname = path.relative(rootDir, dirpath);
                    const metadata = statSync(filePath);
                    const fileDate = createFileData(metadata, dirname);

                    if (SupportedExtensions.IMAGE.indexOf(ext) > -1) {
                        //definite is an image
                        const info = await getFileInfo(filePath);

                        //if pdf or ai which:
                        // is AI with multiple layers
                        // OR
                        // is AI OR PDF which is supposed to be converted to gif
                        if (ext === FileExtensions.AI || ext === FileExtensions.PDF) {

                            if (basename.startsWith('gif')) {
                                const slug = `${dirname ? dirpath + '_' : ''}${slugify(filename)}`;
                                const emptyFolder = path.join(dirpath, slug);
                                await executeCommand(commands.mkdir(emptyFolder));
                                await executeCommand(commands.extractPages(filePath, emptyFolder, slug));
                                return fileDate(slug)
                            } else if (info.layers > 1) {
                                if (ext === FileExtensions.AI) {
                                    console.log('ITS AI AND HAS MORE LAYERS');
                                    //   it is AI with multiple page
                                    await extractPagesFromPdfOrAi(
                                        filename,
                                        ext,
                                        filePath,
                                        dirname,
                                        path.dirname(createConvertFilePath(filePath)),
                                        info
                                    );
                                    return fileDate(basename)
                                } else {
                                    // it is PDF WITH multiple pages
                                    await executeCommand(commands.copy(filePath, createConvertFilePath(filePath)));
                                    return fileDate(basename)
                                }
                            }

                            //here it is pdf or gif which has only ONE page and so we convert it to image
                            const slug = `${info.format}-${filename}.png`;
                            const to = path.join(outputDir, dirname, slug);
                            // await imagesDefaultHandler(filePath, info, to);
                            await createResponsiveImages(filePath, to, info);

                            return fileDate(slug)
                        }

                        if (ext === FileExtensions.PSD || ext === FileExtensions.TIFF) {
                            const targetPath = createConvertFilePath(filePath);
                            // await imagesDefaultHandler(filePath, info, targetPath.replace(ext, '.jpg'));
                            await createResponsiveImages(filePath, targetPath.replace(ext, '.jpg'), info);
                        } else {
                            // await imagesDefaultHandler(filePath, info, createConvertFilePath(filePath));
                            await createResponsiveImages(filePath, createConvertFilePath(filePath), info);
                        }

                        return fileDate(basename)
                    }
                    else if (SupportedExtensions.TEXT.indexOf(ext) > -1) {
                        const output = path.join(outputDir, dirname);
                        await executeCommand(commands.generateThumbnail(filePath, output));
                        return fileDate(filename)
                    }
                }
        )
    );


    const gifData = await sequential(
        gifs.map((gifDirPath) => async () => {
            const allFilesInFolder = readdirSync(gifDirPath);
            const allImagesInFolder = allFilesInFolder.filter(img => {
                return SupportedExtensions.IMAGE.indexOf(path.extname(img).toLowerCase()) > -1
            });

            const firstImageInFolder = allImagesInFolder[0];

            const metadata = statSync(`${gifDirPath}/${firstImageInFolder}`);
            const relPath = path.relative(rootDir, gifDirPath);
            const convertPath = path.join(outputDir, relPath);
            const frames = path.join(gifDirPath, '*.*');

            const fileData = createFileData(metadata, relPath);

            const cmd = commands.generateGif(frames, convertPath);
            await executeCommand(cmd);

            return fileData(relPath)
        })
    );

    writeFileSync(`${outputDir}/data.json`, JSON.stringify(data.concat(gifData), null, 2));
};



