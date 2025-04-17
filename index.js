const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const app = express();

app.use(express.json());

function textToBitmap({
	text,
	fontPath,
	targetRows = 16,
	fontWeight = 'normal',
	scale = null,
}) {
	const internalFontSize = 200;

	// Register font
	registerFont(path.resolve(fontPath), { family: 'LED_FONT' });

	// Step 1: Measure text width using temporary canvas
	const tempCanvas = createCanvas(1, 1);
	const tempCtx = tempCanvas.getContext('2d');
	tempCtx.font = `${fontWeight} ${internalFontSize}px "LED_FONT"`;
	const textWidth = tempCtx.measureText(text).width;

	// Step 2: Create a canvas wide enough for the full text
	const canvas = createCanvas(Math.ceil(textWidth + 50), 300); // buffer
	const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = 'white';
	ctx.textBaseline = 'top';
	ctx.font = `${fontWeight} ${internalFontSize}px "LED_FONT"`;
	ctx.fillText(text, 0, 0);

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

	const scaleFactor = scale ?? targetRows / cropHeight;
	const finalWidth = Math.ceil(cropWidth * scaleFactor);

	const finalCanvas = createCanvas(finalWidth, targetRows);
	const finalCtx = finalCanvas.getContext('2d');

	finalCtx.drawImage(
		croppedCanvas,
		0,
		0,
		cropWidth,
		cropHeight,
		0,
		0,
		finalWidth,
		targetRows
	);

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

app.post('/api/bitmap', (req, res) => {
	try {
		const { text, fontPath, targetRows, fontWeight, scale } = req.body;

		if (!text || !fontPath || !targetRows) {
			return res
				.status(400)
				.json({ error: 'Missing required fields: text, fontPath, targetRows' });
		}

		const bitmap = textToBitmap({
			text,
			fontPath,
			targetRows,
			fontWeight: fontWeight || 'normal',
			scale,
		});

		res.setHeader('Content-Type', 'text/plain');
		res.send(bitmap);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Something went wrong' });
	}
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
	console.log(`🟢 Server running on port ${PORT}`);
});
