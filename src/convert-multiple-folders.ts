import {convertDir} from './convertor';
import {readdirSync} from 'fs';


(async () => {
    const root = process.argv[2];
    console.log(root);
    const folders = readdirSync(root)
        .filter(dir => !dir.startsWith(".") && !dir.startsWith("_") )
        .map(dir => `${root}/${dir}`);

    const handler = async (index: number = 0) => {
        if(index > folders.length){
            console.log("all done");
            return;
        }

        await convertDir(folders[index]);
        console.log(`${index}: ${folders[index]} is DOEN`);
        handler(index+1);
    }

    handler();
})();