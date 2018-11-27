import {convertDir} from './convertor';
import {readdirSync, readFileSync, writeFileSync, writeSync} from 'fs';
import slugify from 'slugify';
import {BasicData} from './types/basic-data';
import * as path from 'path';
const sequential = require('promise-sequential');
import * as _ from "lodash";

export const readJson = <T>(_path: string): T => {
    return JSON.parse( readFileSync(_path).toString('utf8') )
};

export const saveJson = <T>(filepath: string, data: T): void => {
    writeFileSync(filepath, JSON.stringify(data, null, 2));
    writeFileSync(filepath.replace(".json", ".min.json"), JSON.stringify(data));
};

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

(async () => {
    const root = process.argv[2];
    const folders = readdirSync(root)
        .filter(dir => !dir.startsWith(".") && !dir.startsWith("_"))
        .map(dir => `${root}/${dir}`);

    const headers = ["index", "slug", "tags"];

    const data = await Promise.all(
        folders.map(async(folder, index) => {
            let files = readJson<BasicData[]>(`${folder}/data.json`);
            files = files.filter(f=>f);
            const slug = path.basename(folder);
            const years = files.map(d => new Date(d.metadata.birthtimeMs).getFullYear())
            const year = years.length > 0 ? Math.min(...years) : "";
            return [index, slug.replace("-converted", ""), year]
        })
    );

    const csv = [headers, ...data].map(d => d.join(" \t ")).join("\n");
    writeFileSync(path.join(root, "test.csv"), csv);
})();

