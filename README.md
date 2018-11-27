Website responsive file converter
====

This module prepare folders and files for a static-site generator which is [here on github](https://github.com/amirhouieh/amir.cloud.archive).

## intention
Originally I made it to create an [online archive](https://archive.amir.cloud) for all projects I did during my study at KABK, Graphic design department.
But two problems made me to decide to automate this process:

 1. I am not a big fan of doing editorial jobs myself
 2. Considering the big mess of the visual content I had managed to create over 4 years (`.jpg`, `.png`, `.tiff`, `.psd`, `.ai`, `.pdf`, `.txt`, `.pages`, ...)


## how it works:
Basically this whole code its just a converter:
- it converts images inside any folder which starts with `gif` to a `.gif` file
- `.PSD`, `.TIFF` to flatten `.PNG` image with responsive sizes
- generate a responsive `.png` thumbnail for `.PDF` and `.ai` and copy the original
- generate a responsive `.png` thumbnail for `TEXT` files and copy the original

The result of each folder are saved as `data.json` file in the same destination folder.



## stack
This thing is made suing `node js` and `typescript` as framework/language.

## dependencies
- `imagemagick`, `convert`
- Quick Look (`qlmanage`)

the rest you can see in `package.json`

