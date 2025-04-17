const { createCanvas, registerFont } = require('canvas');
const path = require('path');

/**
 * Render text into a full-height bitmap with '#' and '.', aligned as needed.
 */
function textToBitmap({
	text,
	fontPath,
	targetRows = 16, // Total bitmap height (always 16 rows)
	fillRows = 14, // How many rows text should fill within the 16 rows
	align = 'center', // top | center | bottom
	fontSize = 180, // Starting font size
	fontWeight = 'normal', // normal | bold | 600, etc.
	scale = null, // Optional override scaling
}) {
	// Register the font
	registerFont(path.resolve(fontPath), { family: 'LED_FONT' });

	// High resolution canvas to render font
	const HIGH_RES_HEIGHT = 300;
	const canvas = createCanvas(1000, HIGH_RES_HEIGHT);
	const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = 'white';
	ctx.textBaseline = 'top';
	ctx.font = `${fontWeight} ${fontSize}px "LED_FONT"`;
	ctx.fillText(text, 0, 0);

	// Extract bounding box of actual text
	const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const { data, width: imgWidth, height: imgHeight } = imgData;

	let minX = imgWidth,
		maxX = 0,
		minY = imgHeight,
		maxY = 0;
	for (let y = 0; y < imgHeight; y++) {
		for (let x = 0; x < imgWidth; x++) {
			const i = (y * imgWidth + x) * 4;
			const brightness = data[i] + data[i + 1] + data[i + 2];
			if (brightness > 128) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
			}
		}
	}

	const cropWidth = maxX - minX + 1;
	const cropHeight = maxY - minY + 1;

	const croppedCanvas = createCanvas(cropWidth, cropHeight);
	const croppedCtx = croppedCanvas.getContext('2d');
	croppedCtx.putImageData(
		ctx.getImageData(minX, minY, cropWidth, cropHeight),
		0,
		0
	);

	// Calculate scale to fit text into `fillRows`
	const scaleFactor = scale ?? fillRows / cropHeight;
	const finalWidth = Math.ceil(cropWidth * scaleFactor);

	// Final canvas with constant 16-row height
	const finalCanvas = createCanvas(finalWidth, targetRows);
	const finalCtx = finalCanvas.getContext('2d');

	const startY = (() => {
		if (align === 'top') return 0;
		if (align === 'bottom') return targetRows - fillRows;
		return Math.floor((targetRows - fillRows) / 2);
	})();

	finalCtx.drawImage(
		croppedCanvas,
		0,
		0,
		cropWidth,
		cropHeight, // source
		0,
		startY,
		finalWidth,
		fillRows // destination
	);

	// Extract pixel data and convert to bitmap
	const finalImage = finalCtx.getImageData(0, 0, finalWidth, targetRows);
	const output = [];

	for (let y = 0; y < targetRows; y++) {
		let line = '';
		for (let x = 0; x < finalWidth; x++) {
			const i = (y * finalWidth + x) * 4;
			const brightness =
				(finalImage.data[i] + finalImage.data[i + 1] + finalImage.data[i + 2]) /
				3;
			line += brightness > 128 ? '#' : '.';
		}
		output.push(line);
	}

	return output.join('\n');
}

// const result = textToBitmap({
// 	text: 'నాంపల్లి',
// 	fontPath: './noto.ttf',
// 	targetRows: 16,
// 	fontSize: 300,
// 	fitToRows: true, // ➡️ fontSize respected
// 	align: 'left',
// });

// console.log(result);

const bitmap = textToBitmap({
	text: 'नामपल्ली', // Hindi or Telugu or any language
	fontPath: './hindi.ttf', // or any proper font path
	targetRows: 16,
	fillRows: 14, // Fill 14 rows and center it inside 16
	align: 'right',
	fontSize: 100,
	fontWeight: 'normal',
});

console.log(bitmap);
