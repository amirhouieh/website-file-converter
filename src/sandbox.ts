import {convertDir} from './convertor';
import {readdirSync, readFileSync, writeFileSync, writeSync} from 'fs';
import slugify from 'slugify';
import {BasicData} from './types/basic-data';
import * as path from 'path';
const sequential = require('promise-sequential');
import * as _ from "lodash";
const { transformAndWriteToFile } = require("json-to-frontmatter-markdown");

(async () => {
    const root = process.argv[2];
    const dataPath = `${root}/data.csv`;
    const foldersDir = `${root}/projects`;

    const folders = readdirSync(foldersDir)
        .filter(dir => !dir.startsWith(".") && !dir.startsWith("_"))
        .map(dir => `${foldersDir}/${dir}`);

    const csv = readFileSync(dataPath).toString('utf8');

    const lineToData = (line: string[]) => {
      return {
          index: line.shift().toLowerCase(),
          slug: line.shift().toLowerCase(),
          title: line.shift().toLowerCase(),
          text: line.shift().toLowerCase(),
          year: line.shift().toLowerCase(),
          tags: line.filter(t => t.trim().length > 0).map(t=>t.toLowerCase()),
      }
    };
    const data = csv
        .split("\n")
        .slice(1)
        .map(line => lineToData(line.trim().split(",")));


    data.forEach(async(fileData) => {
        let md = `---\n`;

        const dir = folders.find(folder => {
            const slug = path.basename(folder).replace("-converted", "");
            return slug === fileData.slug
        });

        md += Object
            .keys(fileData)
            .map(key =>{
                const value = fileData[key];
                if(typeof value === "string"){
                    return `${key}: "${value}"`
                }else if (_.isArray(value)){
                    return `${key}: [${value.map(v=>`"${v}"`).join(", ")}]`
                }
            }).join("\n");
        md += `\n---\n`;

        console.log(`${fileData.slug} -> ${dir}`);
        await writeFileSync(`${dir}/index.md`, md);
    })

})();