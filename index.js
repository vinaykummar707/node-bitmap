const fs = require('fs');
const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fontkit = require('fontkit');
const app = express();

app.use(express.json());
const cors = require('cors');
app.use(cors()); // Allow all origins

function renderTextCanvas(text, fontSize, fontWeight, fontFamily) {
	const tempCanvas = createCanvas(1, 1);
	const tempCtx = tempCanvas.getContext('2d');
	tempCtx.font = ` ${fontWeight} ${fontSize}px "${fontFamily}"`; // No font weight
	const textWidth = Math.ceil(tempCtx.measureText(text).width);
	const textHeight = fontSize * 1.6;

	const canvas = createCanvas(textWidth, textHeight);
	const ctx = canvas.getContext('2d');
	ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#000';
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillText(text, 0, 0);
	return canvas;
}

// === Bounding Box of Black or Semi-Black Pixels ===
function getTextBoundingBox(ctx, width, height, threshold) {
	const { data } = ctx.getImageData(0, 0, width, height);
	let top = height,
		bottom = 0,
		left = width,
		right = 0;
	let found = false;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
			const brightness = (r + g + b) / 3;
			if (brightness < threshold && a > 0) {
				found = true;
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
		}
	}

	if (!found) {
		console.warn(
			'⚠️ Warning: No black text detected. Try increasing font size or lowering threshold.'
		);
		return { top: 0, bottom: height, left: 0, right: width };
	}

	return { top, bottom, left, right };
}

// === ASCII Generator ===
function generateASCII(ctx, width, height, bbox, rows, aspectRatio, threshold) {
	const { top, bottom, left, right } = bbox;
	const cropHeight = bottom - top + 1;
	const cropWidth = right - left + 1;

	const rowStep = cropHeight / rows;
	const colCount = Math.floor(cropWidth * aspectRatio);
	const colStep = cropWidth / colCount;

	let ascii = '';

	for (let row = 1; row < rows; row++) {
		const y = Math.floor(top + row * rowStep);
		for (let col = 0; col < colCount; col++) {
			const x = Math.floor(left + col * colStep);
			const pixel = ctx.getImageData(x, y, 1, 1).data;
			const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
			const isDark = brightness < threshold && pixel[3] > 0;
			ascii += isDark ? '#' : '.';
		}
		ascii += '\n';
	}

	return ascii;
}

function getFontMetadata(ttfPath) {
	const font = fontkit.openSync(path.resolve(ttfPath));
	return {
		fullName: font.fullName, // e.g. "Roboto Bold"
		familyName: font.familyName, // e.g. "Roboto"
		subfamilyName: font.subfamilyName, // e.g. "Bold"
		postscriptName: font.postscriptName, // e.g. "Roboto-Bold"
	};
}

app.post('/api/bitmap', (req, res) => {
	try {
		const {
			text,
			fontPath,
			targetRows,
			fontWeight,
			aspectRatio,
			thresshold,
			fontFamily,
			fontSize,
		} = req.body;

		if (!text || !fontPath || !targetRows) {
			return res
				.status(400)
				.json({ error: 'Missing required fields: text, fontPath, targetRows' });
		}

		const meta = getFontMetadata(fontPath);

		const canvasFamilyName = `${meta.familyName}-${meta.subfamilyName}`;
		registerFont(fontPath, { family: canvasFamilyName });

		const canvas = renderTextCanvas(
			text,
			fontSize,
			fontWeight,
			canvasFamilyName
		);
		const ctx = canvas.getContext('2d');

		const bbox = getTextBoundingBox(
			ctx,
			canvas.width,
			canvas.height,
			thresshold
		);

		// Save image (optional)
		const out = fs.createWriteStream('output.png');
		canvas.createPNGStream().pipe(out);
		out.on('finish', () => console.log(`✅ Image saved to output.png`));

		// Generate ASCII
		const ascii = generateASCII(
			ctx,
			canvas.width,
			canvas.height,
			bbox,
			targetRows,
			aspectRatio,
			thresshold
		);

		// fs.writeFileSync(ASCII_OUTPUT, ascii);
		// console.log(`✅ ASCII saved to ${ASCII_OUTPUT}`);

		res.send(ascii);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Something went wrong' });
	}
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
	console.log(`🟢 Server running on port ${PORT}`);
});
