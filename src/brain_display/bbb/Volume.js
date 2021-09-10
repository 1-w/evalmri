define([path.join(__dirname, "VVutils")], function (utils) {
  class Volume {
    constructor(description, header, native_data) {
      this.description = description;
      this.data = native_data;
      this.header = header;
      this.#finishHeader(header);
    }

    #finishHeader(header) {
      header.xspace.name = "xspace";
      header.yspace.name = "yspace";
      header.zspace.name = "zspace";

      header.xspace.width_space = header.yspace;
      header.xspace.width = header.yspace.space_length;
      header.xspace.height_space = header.zspace;
      header.xspace.height = header.zspace.space_length;

      header.yspace.width_space = header.xspace;
      header.yspace.width = header.xspace.space_length;
      header.yspace.height_space = header.zspace;
      header.yspace.height = header.zspace.space_length;

      header.zspace.width_space = header.xspace;
      header.zspace.width = header.xspace.space_length;
      header.zspace.height_space = header.yspace;
      header.zspace.height = header.yspace.space_length;

      if (header.voxel_min === undefined) header.voxel_min = 0;
      if (header.voxel_max === undefined) header.voxel_max = 255;
      this.intensity_min = this.header.voxel_min;
      this.intensity_max = this.header.voxel_max;
    }
    image_creation_context = document.createElement("canvas").getContext("2d");
    cached_slices = {};

    // Populate the header with the universal fields.

    position = {};
    current_time = 0;
    data = null;
    header = null;
    intensity_min = 0;
    intensity_max = 255;

    slice = function (axis, slice_num, time) {
      time = time === undefined ? this.current_time : time;

      var header = this.header;

      if (header.order === undefined) {
        return null;
      }

      time = time || 0;

      var axis_space = header[axis];
      slice_num =
        slice_num === undefined
          ? axis_space.step > 0
            ? this.position[axis]
            : axis_space.space_length - this.position[axis] - 1
          : slice_num;

      this.cached_slices[axis] = this.cached_slices[axis] || [];
      this.cached_slices[axis][time] = this.cached_slices[axis][time] || [];

      if (this.cached_slices[axis][time][slice_num] !== undefined) {
        return this.cached_slices[axis][time][slice_num];
      }

      var time_offset = header.time ? time * header.time.offset : 0;

      var width_space = axis_space.width_space;
      var height_space = axis_space.height_space;

      var width = axis_space.width;
      var height = axis_space.height;

      var axis_space_offset = axis_space.offset;
      var width_space_offset = width_space.offset;
      var height_space_offset = height_space.offset;

      // Calling the volume data's constructor guarantees that the
      // slice data buffer has the same type as the volume.
      //
      var slice_data = new this.data.constructor(width * height);

      var slice;

      // Rows and colums of the result slice.
      var row, col;

      // Indexes into the volume, relative to the slice.
      // NOT xspace, yspace, zspace coordinates!!!
      var x, y, z;

      // Linear offsets into volume considering an
      // increasing number of axes: (t) time,
      // (z) z-axis, (y) y-axis, (x) x-axis.
      var tz_offset, tzy_offset, tzyx_offset;

      // Whether the dimension steps positively or negatively.
      var x_positive = width_space.step > 0;
      var y_positive = height_space.step > 0;
      var z_positive = axis_space.step > 0;

      // iterator for the result slice.
      var i = 0;

      z = z_positive ? slice_num : axis_space.space_length - slice_num - 1;
      if (z >= 0 && z < axis_space.space_length) {
        tz_offset = time_offset + z * axis_space_offset;

        for (row = height - 1; row >= 0; row--) {
          y = y_positive ? row : height - row - 1;
          tzy_offset = tz_offset + y * height_space_offset;

          for (col = 0; col < width; col++) {
            x = x_positive ? col : width - col - 1;
            tzyx_offset = tzy_offset + x * width_space_offset;

            slice_data[i++] = this.data[tzyx_offset];
          }
        }
      }

      slice = {
        axis: axis,
        data: slice_data,
        width_space: width_space,
        height_space: height_space,
        width: width,
        height: height,
      };

      this.cached_slices[axis][time][slice_num] = slice;

      return slice;
    };

    // Calculate the world to voxel transform and save it, so we
    // can access it efficiently. The transform is:
    // cxx / stepx | cxy / stepx | cxz / stepx | (-o.x * cxx - o.y * cxy - o.z * cxz) / stepx
    // cyx / stepy | cyy / stepy | cyz / stepy | (-o.x * cyx - o.y * cyy - o.z * cyz) / stepy
    // czx / stepz | czy / stepz | czz / stepz | (-o.x * czx - o.y * czy - o.z * czz) / stepz
    // 0           | 0           | 0           | 1

    // Origin equation taken from (http://www.bic.mni.mcgill.ca/software/minc/minc2_format/node4.html)

    saveOriginAndTransform = function (header) {
      var startx = header.xspace.start;
      var starty = header.yspace.start;
      var startz = header.zspace.start;
      var cx = header.xspace.direction_cosines;
      var cy = header.yspace.direction_cosines;
      var cz = header.zspace.direction_cosines;
      var stepx = header.xspace.step;
      var stepy = header.yspace.step;
      var stepz = header.zspace.step;
      header.voxel_origin = {
        x: startx * cx[0] + starty * cy[0] + startz * cz[0],
        y: startx * cx[1] + starty * cy[1] + startz * cz[1],
        z: startx * cx[2] + starty * cy[2] + startz * cz[2],
      };
      var o = header.voxel_origin;

      var tx = (-o.x * cx[0] - o.y * cx[1] - o.z * cx[2]) / stepx;
      var ty = (-o.x * cy[0] - o.y * cy[1] - o.z * cy[2]) / stepy;
      var tz = (-o.x * cz[0] - o.y * cz[1] - o.z * cz[2]) / stepz;

      header.w2v = [
        [cx[0] / stepx, cx[1] / stepx, cx[2] / stepx, tx],
        [cy[0] / stepy, cy[1] / stepy, cy[2] / stepy, ty],
        [cz[0] / stepz, cz[1] / stepz, cz[2] / stepz, tz],
      ];
    };

    getSliceImage = function (slice, zoom, contrast, brightness) {
      zoom = zoom || 1;

      var color_map = this.color_map;
      var error_message;

      if (!color_map && this.description.template.type != "atlas") {
        error_message =
          "No color map set for this volume. Cannot render slice.";
        throw new Error(error_message);
      }

      var xstep = slice.width_space.step;
      var ystep = slice.height_space.step;
      var target_width = Math.abs(Math.floor(slice.width * xstep * zoom));
      var target_height = Math.abs(Math.floor(slice.height * ystep * zoom));
      var source_image = this.image_creation_context.createImageData(
        slice.width,
        slice.height
      );
      var target_image = this.image_creation_context.createImageData(
        target_width,
        target_height
      );

      if (this.description.template.type != "atlas") {
        if (this.header.datatype === "rgb8") {
          var tmp = new Uint8ClampedArray(slice.data.buffer);
          source_image.data.set(tmp, 0);
        } else {
          color_map.mapColors(slice.data, {
            min: this.intensity_min,
            max: this.intensity_max,
            contrast: contrast,
            brightness: brightness,
            destination: source_image.data,
          });
        }
      }

      target_image.data.set(
        utils.nearestNeighbor(
          source_image.data,
          source_image.width,
          source_image.height,
          target_width,
          target_height,
          {}
        )
      );

      return target_image;
    };

    getIntensityValue = function (i, j, k, time) {
      var header = this.header;
      var vc = this.getVoxelCoords();
      i = i === undefined ? vc.i : i;
      j = j === undefined ? vc.j : j;
      k = k === undefined ? vc.k : k;
      time = time === undefined ? this.current_time : time;

      if (
        i < 0 ||
        i >= header[header.order[0]].space_length ||
        j < 0 ||
        j >= header[header.order[1]].space_length ||
        k < 0 ||
        k >= header[header.order[2]].space_length
      ) {
        return 0;
      }
      var time_offset = header.time ? time * header.time.offset : 0;
      var xyzt_offset =
        i * header[header.order[0]].offset +
        j * header[header.order[1]].offset +
        k * header[header.order[2]].offset +
        time_offset;
      return this.data[xyzt_offset];
    };

    getVoxelCoords = function () {
      var header = this.header;
      var position = {
        xspace:
          header.xspace.step > 0
            ? this.position.xspace
            : header.xspace.space_length - this.position.xspace,
        yspace:
          header.yspace.step > 0
            ? this.position.yspace
            : header.yspace.space_length - this.position.yspace,
        zspace:
          header.zspace.step > 0
            ? this.position.zspace
            : header.zspace.space_length - this.position.zspace,
      };

      return {
        i: position[header.order[0]],
        j: position[header.order[1]],
        k: position[header.order[2]],
      };
    };

    setVoxelCoords = function (i, j, k) {
      var header = this.header;
      var ispace = header.order[0];
      var jspace = header.order[1];
      var kspace = header.order[2];

      this.position[ispace] =
        header[ispace].step > 0 ? i : header[ispace].space_length - i;
      this.position[jspace] =
        header[jspace].step > 0 ? j : header[jspace].space_length - j;
      this.position[kspace] =
        header[kspace].step > 0 ? k : header[kspace].space_length - k;
    };

    getWorldCoords = function () {
      var voxel = this.getVoxelCoords();

      return this.voxelToWorld(voxel.i, voxel.j, voxel.k);
    };

    setWorldCoords = function (x, y, z) {
      var voxel = this.worldToVoxel(x, y, z);

      this.setVoxelCoords(voxel.i, voxel.j, voxel.k);
    };

    // Voxel to world matrix applied here is:
    // cxx * stepx | cyx * stepy | czx * stepz | ox
    // cxy * stepx | cyy * stepy | czy * stepz | oy
    // cxz * stepx | cyz * stepy | czz * stepz | oz
    // 0           | 0           | 0           | 1
    //
    // Taken from (http://www.bic.mni.mcgill.ca/software/minc/minc2_format/node4.html)
    voxelToWorld = function (i, j, k) {
      var ordered = {};
      var x, y, z;
      var header = this.header;

      ordered[header.order[0]] = i;
      ordered[header.order[1]] = j;
      ordered[header.order[2]] = k;

      x = ordered.xspace;
      y = ordered.yspace;
      z = ordered.zspace;

      var cx = header.xspace.direction_cosines;
      var cy = header.yspace.direction_cosines;
      var cz = header.zspace.direction_cosines;
      var stepx = header.xspace.step;
      var stepy = header.yspace.step;
      var stepz = header.zspace.step;
      var o = header.voxel_origin;

      return {
        x: x * cx[0] * stepx + y * cy[0] * stepy + z * cz[0] * stepz + o.x,
        y: x * cx[1] * stepx + y * cy[1] * stepy + z * cz[1] * stepz + o.y,
        z: x * cx[2] * stepx + y * cy[2] * stepy + z * cz[2] * stepz + o.z,
      };
    };

    // Inverse of the voxel to world matrix.
    worldToVoxel = function (x, y, z) {
      var xfm = header.w2v; // Get the world-to-voxel transform.
      var result = {
        vx: x * xfm[0][0] + y * xfm[0][1] + z * xfm[0][2] + xfm[0][3],
        vy: x * xfm[1][0] + y * xfm[1][1] + z * xfm[1][2] + xfm[1][3],
        vz: x * xfm[2][0] + y * xfm[2][1] + z * xfm[2][2] + xfm[2][3],
      };

      var ordered = {};
      ordered[header.order[0]] = Math.round(result.vx);
      ordered[header.order[1]] = Math.round(result.vy);
      ordered[header.order[2]] = Math.round(result.vz);

      return {
        i: ordered.xspace,
        j: ordered.yspace,
        k: ordered.zspace,
      };
    };
    getVoxelMin = function () {
      return this.header.voxel_min;
    };
    getVoxelMax = function () {
      return this.header.voxel_max;
    };
    /* given a width and height (from the panel), this function returns the "best"
     * single zoom level that will guarantee that the image fits exactly into the
     * current panel.
     */
    getPreferredZoom = function (width, height) {
      var header = this.header;
      var x_fov = header.xspace.space_length * Math.abs(header.xspace.step);
      var y_fov = header.yspace.space_length * Math.abs(header.yspace.step);
      var z_fov = header.zspace.space_length * Math.abs(header.xspace.step);
      var xw = width / x_fov;
      var yw = width / y_fov;
      var yh = height / y_fov;
      var zh = height / z_fov;
      return Math.min(yw, xw, zh, yh);
    };
  }
  return Volume;
});
