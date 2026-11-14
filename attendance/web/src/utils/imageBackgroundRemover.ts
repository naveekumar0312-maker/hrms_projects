/**
 * Automatically removes background from image files (e.g. logos with solid white,
 * near-white, or single-color background) by analyzing corner and border colors
 * using Flood Fill / Color Distance matching on HTML5 Canvas.
 * Outputs a clean PNG with transparent alpha channel.
 */
export async function removeLogoBackground(file: File): Promise<File> {
  return new Promise((resolve) => {
    // If SVG or already transparent PNG, we can still process or return
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        resolve(file);
        return;
      }

      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      // Draw original image onto canvas
      ctx.drawImage(img, 0, 0);

      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Sample border corners to detect background color
      const sampleIndices = [
        0, // top-left
        (width - 1) * 4, // top-right
        ((height - 1) * width) * 4, // bottom-left
        ((height - 1) * width + (width - 1)) * 4, // bottom-right
        Math.floor(width / 2) * 4, // top-center
        ((height - 1) * width + Math.floor(width / 2)) * 4, // bottom-center
      ];

      // Count candidate background colors
      const bgCandidates: { r: number; g: number; b: number; a: number }[] = [];
      for (const idx of sampleIndices) {
        const a = data[idx + 3];
        // If corner is already transparent, image might already be transparent
        if (a < 10) continue;
        bgCandidates.push({
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
          a: a,
        });
      }

      // If already transparent in multiple corners, return original
      if (bgCandidates.length < 2) {
        resolve(file);
        return;
      }

      // Pick top-left as default reference, or majority white/light color
      let refBg = bgCandidates[0];
      for (const c of bgCandidates) {
        // Prefer near-white or light background
        if (c.r > 230 && c.g > 230 && c.b > 230) {
          refBg = c;
          break;
        }
      }

      const tolerance = 42; // Color distance threshold
      const visited = new Uint8Array(width * height);
      const queue: number[] = [];

      function colorMatches(r: number, g: number, b: number, a: number): boolean {
        if (a < 15) return true;
        // Euclidean distance in RGB
        const dr = r - refBg.r;
        const dg = g - refBg.g;
        const db = b - refBg.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        // Also if both pixel and refBg are very bright near-white (common in JPEG logos)
        if (r >= 235 && g >= 235 && b >= 235 && refBg.r >= 230 && refBg.g >= 230 && refBg.b >= 230) {
          return true;
        }

        return dist <= tolerance;
      }

      // Seed flood fill from all 4 boundaries (contiguous background from outer edges)
      for (let x = 0; x < width; x++) {
        // Top edge
        const topIdx = x;
        const topDataIdx = topIdx * 4;
        if (colorMatches(data[topDataIdx], data[topDataIdx + 1], data[topDataIdx + 2], data[topDataIdx + 3])) {
          queue.push(topIdx);
          visited[topIdx] = 1;
        }

        // Bottom edge
        const botIdx = (height - 1) * width + x;
        const botDataIdx = botIdx * 4;
        if (colorMatches(data[botDataIdx], data[botDataIdx + 1], data[botDataIdx + 2], data[botDataIdx + 3])) {
          queue.push(botIdx);
          visited[botIdx] = 1;
        }
      }

      for (let y = 0; y < height; y++) {
        // Left edge
        const leftIdx = y * width;
        const leftDataIdx = leftIdx * 4;
        if (!visited[leftIdx] && colorMatches(data[leftDataIdx], data[leftDataIdx + 1], data[leftDataIdx + 2], data[leftDataIdx + 3])) {
          queue.push(leftIdx);
          visited[leftIdx] = 1;
        }

        // Right edge
        const rightIdx = y * width + (width - 1);
        const rightDataIdx = rightIdx * 4;
        if (!visited[rightIdx] && colorMatches(data[rightDataIdx], data[rightDataIdx + 1], data[rightDataIdx + 2], data[rightDataIdx + 3])) {
          queue.push(rightIdx);
          visited[rightIdx] = 1;
        }
      }

      // Perform BFS Flood Fill to remove background connected to edges
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = Math.floor(curr / width);

        // Turn this pixel transparent
        const pIdx = curr * 4;
        data[pIdx + 3] = 0;

        // Check 4 neighbors (Up, Down, Left, Right)
        const neighbors = [
          cy > 0 ? (cy - 1) * width + cx : -1,
          cy < height - 1 ? (cy + 1) * width + cx : -1,
          cx > 0 ? cy * width + (cx - 1) : -1,
          cx < width - 1 ? cy * width + (cx + 1) : -1,
        ];

        for (const n of neighbors) {
          if (n !== -1 && !visited[n]) {
            visited[n] = 1;
            const nDataIdx = n * 4;
            if (colorMatches(data[nDataIdx], data[nDataIdx + 1], data[nDataIdx + 2], data[nDataIdx + 3])) {
              queue.push(n);
            }
          }
        }
      }

      // Feather/soften edge pixels to prevent jagged fringe
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const pIdx = idx * 4;
          if (data[pIdx + 3] > 0) {
            // Check if neighboring a transparent pixel
            const hasTransparentNeighbor =
              data[((y - 1) * width + x) * 4 + 3] === 0 ||
              data[((y + 1) * width + x) * 4 + 3] === 0 ||
              data[(y * width + (x - 1)) * 4 + 3] === 0 ||
              data[(y * width + (x + 1)) * 4 + 3] === 0;

            if (hasTransparentNeighbor) {
              const dr = data[pIdx] - refBg.r;
              const dg = data[pIdx + 1] - refBg.g;
              const db = data[pIdx + 2] - refBg.b;
              const dist = Math.sqrt(dr * dr + dg * dg + db * db);
              if (dist < tolerance * 1.5) {
                // Partial transparency for smooth anti-aliased edge
                data[pIdx + 3] = Math.max(0, Math.min(255, Math.floor((dist / (tolerance * 1.5)) * 255)));
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Export processed canvas as PNG Blob/File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const newFile = new File([blob], `${baseName}-transparent.png`, {
            type: 'image/png',
          });
          resolve(newFile);
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

