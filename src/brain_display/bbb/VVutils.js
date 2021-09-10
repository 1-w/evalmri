define(function () {
  return {
    nearestNeighbor: function (
      source,
      width,
      height,
      target_width,
      target_height,
      options
    ) {
      options = options || {};

      let block_size = options.block_size || 4;
      let ArrayType = options.array_type || Uint8ClampedArray;

      let x_ratio, y_ratio;
      let source_y_offset, source_block_offset;
      let target;
      let target_x, target_y;
      let target_y_offset, target_block_offset;
      let k;

      //Do nothing if size is the same
      if (width === target_width && height === target_height) {
        return source;
      }

      target = new ArrayType(target_width * target_height * block_size);
      x_ratio = width / target_width;
      y_ratio = height / target_height;
      for (target_y = 0; target_y < target_height; target_y++) {
        source_y_offset = Math.floor(target_y * y_ratio) * width;
        target_y_offset = target_y * target_width;

        for (target_x = 0; target_x < target_width; target_x++) {
          source_block_offset =
            (source_y_offset + Math.floor(target_x * x_ratio)) * block_size;
          target_block_offset = (target_y_offset + target_x) * block_size;

          for (k = 0; k < block_size; k++) {
            target[target_block_offset + k] = source[source_block_offset + k];
          }
        }
      }

      return target;
    },

    flipArray: function (source, width, height, options) {
      options = options || {};

      let flipx = options.flipx || false;
      let flipy = options.flipy || false;
      let block_size = options.block_size || 1;
      let target = new source.constructor(source.length);
      let i, j, k;
      let x, y;
      let target_row_offset, target_offset;
      let source_row_offset, source_offset;

      if (!flipx && !flipy) {
        for (i = 0, j = source.length; i < j; i++) {
          target[i] = source[i];
        }
        return target;
      }

      for (j = 0; j < height; j++) {
        target_row_offset = j * width;
        y = flipy ? height - j - 1 : j;
        source_row_offset = y * width;

        for (i = 0; i < width; i++) {
          target_offset = (target_row_offset + i) * block_size;
          x = flipx ? width - i - 1 : i;
          source_offset = (source_row_offset + x) * block_size;

          for (k = 0; k < block_size; k++) {
            target[target_offset + k] = source[source_offset + k];
          }
        }
      }

      return target;
    },
    swapn: function (byte_data, n_per_item) {
      for (let d = 0; d < byte_data.length; d += n_per_item) {
        let hi_offset = n_per_item - 1;
        let lo_offset = 0;
        while (hi_offset > lo_offset) {
          let tmp = byte_data[d + hi_offset];
          byte_data[d + hi_offset] = byte_data[d + lo_offset];
          byte_data[d + lo_offset] = tmp;
          hi_offset--;
          lo_offset++;
        }
      }
    },
    scanDataRange: function (native_data, header) {
      let d = 0;
      let n_min = +Infinity;
      let n_max = -Infinity;

      for (d = 0; d < native_data.length; d++) {
        let value = native_data[d];
        if (value > n_max) n_max = value;
        if (value < n_min) n_min = value;
      }
      header.voxel_min = n_min;
      header.voxel_max = n_max;
    },
    transformToMinc: function (transform, header) {
      let x_dir_cosines = [];
      let y_dir_cosines = [];
      let z_dir_cosines = [];

      // A tiny helper function to calculate the magnitude of the rotational
      // part of the transform.
      //
      function magnitude(v) {
        let dotprod = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        if (dotprod <= 0) {
          dotprod = 1.0;
        }
        return Math.sqrt(dotprod);
      }

      // Calculate the determinant of a 3x3 matrix, from:
      // http://www.mathworks.com/help/aeroblks/determinantof3x3matrix.html
      //
      // det(A) = A_{11} (A_{22}A_{33} - A_{23}A_{32}) -
      //          A_{12} (A_{21}A_{33} - A_{23}A_{31}) +
      //          A_{13} (A_{21}A_{32} - A_{22}A_{31})
      //
      // Of course, I had to change the indices from 1-based to 0-based.
      //
      function determinant(c0, c1, c2) {
        return (
          c0[0] * (c1[1] * c2[2] - c1[2] * c2[1]) -
          c0[1] * (c1[0] * c2[2] - c1[2] * c2[0]) +
          c0[2] * (c1[0] * c2[1] - c1[1] * c2[0])
        );
      }

      // Now that we have the transform, need to convert it to MINC-like
      // steps and direction_cosines.

      let xmag = magnitude(transform[0]);
      let ymag = magnitude(transform[1]);
      let zmag = magnitude(transform[2]);

      //radiological convention
      let xstep = transform[0][0] < 0 ? xmag : -xmag;
      //let ystep = transform[1][1] < 0 ? ymag : -ymag;
      //let zstep = transform[2][2] < 0 ? zmag : -zmag;

      //neurological convention
      //let xstep = transform[0][0] < 0 ? -xmag : xmag;
      let ystep = transform[1][1] < 0 ? -ymag : ymag;
      let zstep = transform[2][2] < 0 ? -zmag : zmag;

      for (let i = 0; i < 3; i++) {
        x_dir_cosines[i] = transform[i][0] / xstep;
        y_dir_cosines[i] = transform[i][1] / ystep;
        z_dir_cosines[i] = transform[i][2] / zstep;
      }

      header.xspace.step = xstep;
      header.yspace.step = ystep;
      header.zspace.step = zstep;

      // Calculate the corrected start values.
      let starts = [transform[0][3], transform[1][3], transform[2][3]];

      // (bert): I believe that the determinant of the direction
      // cosines should always work out to 1, so the calculation of
      // this value should not be needed. But I have no idea if NIfTI
      // enforces this when sform transforms are written.
      let denom = determinant(x_dir_cosines, y_dir_cosines, z_dir_cosines);
      let xstart = determinant(starts, y_dir_cosines, z_dir_cosines);
      let ystart = determinant(x_dir_cosines, starts, z_dir_cosines);
      let zstart = determinant(x_dir_cosines, y_dir_cosines, starts);

      header.xspace.start = xstart / denom;
      header.yspace.start = ystart / denom;
      header.zspace.start = zstart / denom;

      header.xspace.direction_cosines = x_dir_cosines;
      header.yspace.direction_cosines = y_dir_cosines;
      header.zspace.direction_cosines = z_dir_cosines;
    },
  };
});
