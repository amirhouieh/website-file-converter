import {convertDir} from './convertor';
import {readdirSync} from 'fs';
import slugify from 'slugify';
const sequential = require('promise-sequential');


(async () => {
    const root = process.argv[2];
    console.log(root);
    const folders = readdirSync(root)
        .filter(dir => !dir.startsWith(".") && !dir.startsWith("_") && dir.indexOf("converted") === -1)
        .map(dir => `${root}/${dir}`);

    await sequential(folders.map(folder => () => convertDir(folder) ));
    console.log(`${root} is done`);
})();