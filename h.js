const { createCanvas, registerFont } = require('canvas');

// Example using a Noto Sans font that supports Hindi characters
registerFont('./english.ttf', { family: 'General Sans Variable' });

const canvas = createCanvas(800, 200);
const ctx = canvas.getContext('2d');

ctx.font = '20px "General Sans Variable"';
ctx.fillText('NAMPALLY',0, 100);

const fs = require('fs');
const out = fs.createWriteStream('text.png');
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () =>  console.log('The PNG file was created.'));