import {convertDir} from './convertor';


(async () => {
    const root = process.argv[2];
    await convertDir(root);
})();