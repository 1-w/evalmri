define([
  path.join(__dirname, "VVutils"),
  path.join(__dirname, "BButils"),
  path.join(__dirname, "Loader"),
], function (VVutils, BButils, loader) {
  function parseNifti1Header(raw_data, callback) {
    var header = {
      order: [],
      xspace: {},
      yspace: {},
      zspace: {},
    };
    var error_message;
    var dview = new DataView(raw_data, 0, 348);
    var bytes = new Uint8Array(raw_data, 0, 348);
    var littleEndian = true;

    var sizeof_hdr = dview.getUint32(0, true);
    if (sizeof_hdr === 0x0000015c) {
      littleEndian = true;
    } else if (sizeof_hdr === 0x5c010000) {
      littleEndian = false;
    } else {
      error_message = "This does not look like a NIfTI-1 file.";
    }

    var ndims = dview.getUint16(40, littleEndian);
    if (ndims < 3 || ndims > 4) {
      error_message = "Cannot handle " + ndims + "-dimensional images yet.";
    }

    var magic = String.fromCharCode.apply(null, bytes.subarray(344, 348));
    if (magic !== "n+1\0") {
      error_message = "Bad magic number: '" + magic + "'";
    }

    if (error_message !== undefined) {
      throw new Error(error_message);
    }

    var tlength = dview.getUint16(48, littleEndian);

    var datatype = dview.getUint16(70, littleEndian);
    var bitpix = dview.getUint16(72, littleEndian);

    var xstep = dview.getFloat32(80, littleEndian);
    var ystep = dview.getFloat32(84, littleEndian);
    var zstep = dview.getFloat32(88, littleEndian);
    var tstep = dview.getFloat32(92, littleEndian);

    var vox_offset = dview.getFloat32(108, littleEndian);
    if (vox_offset < 352) {
      vox_offset = 352;
    }

    var scl_slope = dview.getFloat32(112, littleEndian);
    var scl_inter = dview.getFloat32(116, littleEndian);

    var qform_code = dview.getUint16(252, littleEndian);
    var sform_code = dview.getUint16(254, littleEndian);

    var nifti_xfm = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    if (tlength >= 1) {
      header.time = {};
      header.time.space_length = tlength;
      header.time.step = tstep;
      header.time.start = 0;
      header.time.name = "time";
    }

    /* Record the number of bytes per voxel, and note whether we need
     * to swap bytes in the voxel data.
     */
    header.bytes_per_voxel = bitpix / 8;
    header.must_swap_data = !littleEndian && header.bytes_per_voxel > 1;

    if (sform_code > 0) {
      /* The "Sform", if present, defines an affine transform which is
       * generally assumed to correspond to some standard coordinate
       * space (e.g. Talairach).
       */
      nifti_xfm[0][0] = dview.getFloat32(280, littleEndian);
      nifti_xfm[0][1] = dview.getFloat32(284, littleEndian);
      nifti_xfm[0][2] = dview.getFloat32(288, littleEndian);
      nifti_xfm[0][3] = dview.getFloat32(292, littleEndian);
      nifti_xfm[1][0] = dview.getFloat32(296, littleEndian);
      nifti_xfm[1][1] = dview.getFloat32(300, littleEndian);
      nifti_xfm[1][2] = dview.getFloat32(304, littleEndian);
      nifti_xfm[1][3] = dview.getFloat32(308, littleEndian);
      nifti_xfm[2][0] = dview.getFloat32(312, littleEndian);
      nifti_xfm[2][1] = dview.getFloat32(316, littleEndian);
      nifti_xfm[2][2] = dview.getFloat32(320, littleEndian);
      nifti_xfm[2][3] = dview.getFloat32(324, littleEndian);
    } else if (qform_code > 0) {
      /* The "Qform", if present, defines a quaternion which specifies
       * a less general transformation, often to scanner space.
       */
      var quatern_b = dview.getFloat32(256, littleEndian);
      var quatern_c = dview.getFloat32(260, littleEndian);
      var quatern_d = dview.getFloat32(264, littleEndian);
      var qoffset_x = dview.getFloat32(268, littleEndian);
      var qoffset_y = dview.getFloat32(272, littleEndian);
      var qoffset_z = dview.getFloat32(276, littleEndian);
      var qfac = dview.getFloat32(76, littleEndian) < 0 ? -1.0 : 1.0;

      nifti_xfm = niftiQuaternToMat44(
        quatern_b,
        quatern_c,
        quatern_d,
        qoffset_x,
        qoffset_y,
        qoffset_z,
        xstep,
        ystep,
        zstep,
        qfac
      );
    } else {
      nifti_xfm[0][0] = xstep;
      nifti_xfm[1][1] = ystep;
      nifti_xfm[2][2] = zstep;
    }

    var i, j;
    var axis_index_from_file = [0, 1, 2];
    var transform = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 1],
    ];

    for (i = 0; i < 3; i++) {
      var c_x = Math.abs(nifti_xfm[0][i]);
      var c_y = Math.abs(nifti_xfm[1][i]);
      var c_z = Math.abs(nifti_xfm[2][i]);

      if (c_x > c_y && c_x > c_z) {
        header.order[2 - i] = "xspace";
        axis_index_from_file[i] = 0;
      } else if (c_y > c_x && c_y > c_z) {
        header.order[2 - i] = "yspace";
        axis_index_from_file[i] = 1;
      } else {
        header.order[2 - i] = "zspace";
        axis_index_from_file[i] = 2;
      }
    }

    for (i = 0; i < 3; i++) {
      for (j = 0; j < 4; j++) {
        var volume_axis = j;
        if (j < 3) {
          volume_axis = axis_index_from_file[j];
        }
        transform[i][volume_axis] = nifti_xfm[i][j];
      }
    }

    VVutils.transformToMinc(transform, header);

    header[header.order[2]].space_length = dview.getUint16(42, littleEndian);
    header[header.order[1]].space_length = dview.getUint16(44, littleEndian);
    header[header.order[0]].space_length = dview.getUint16(46, littleEndian);

    if (tlength >= 1) {
      header.order.unshift("time");
    }

    header.datatype = datatype;
    header.vox_offset = vox_offset;
    header.scl_slope = scl_slope;
    header.scl_inter = scl_inter;

    return header;
  }

  /* This function is a direct translation of the identical function
   * found in the standard NIfTI-1 library (nifti1_io.c).
   */
  function niftiQuaternToMat44(qb, qc, qd, qx, qy, qz, dx, dy, dz, qfac) {
    var m = [
      // 4x4 transform
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 1],
    ];
    var b = qb;
    var c = qc;
    var d = qd;
    var a, xd, yd, zd;

    // compute a parameter from b,c,d

    a = 1.0 - (b * b + c * c + d * d);
    if (a < 1e-7) {
      // special case
      a = 1.0 / Math.sqrt(b * b + c * c + d * d);
      b *= a; // normalize (b,c,d) vector
      c *= a;
      d *= a;
      a = 0.0; // a = 0 ==> 180 degree rotation
    } else {
      a = Math.sqrt(a); // angle = 2*arccos(a)
    }

    // load rotation matrix, including scaling factors for voxel sizes

    xd = dx > 0.0 ? dx : 1.0; // make sure are positive
    yd = dy > 0.0 ? dy : 1.0;
    zd = dz > 0.0 ? dz : 1.0;

    if (qfac < 0.0)
      // left handedness?
      zd = -zd;

    m[0][0] = (a * a + b * b - c * c - d * d) * xd;
    m[0][1] = 2.0 * (b * c - a * d) * yd;
    m[0][2] = 2.0 * (b * d + a * c) * zd;
    m[1][0] = 2.0 * (b * c + a * d) * xd;
    m[1][1] = (a * a + c * c - b * b - d * d) * yd;
    m[1][2] = 2.0 * (c * d - a * b) * zd;
    m[2][0] = 2.0 * (b * d - a * c) * xd;
    m[2][1] = 2.0 * (c * d + a * b) * yd;
    m[2][2] = (a * a + d * d - c * c - b * b) * zd;

    // load offsets

    m[0][3] = qx;
    m[1][3] = qy;
    m[2][3] = qz;

    return m;
  }

  function createNifti1Volume(header, raw_data, callback) {
    var volume = BrainBrowser.volumeviewer.createVolume(
      header,
      createNifti1Data(header, raw_data)
    );
    volume.type = "nifti";
    volume.intensity_min = volume.header.voxel_min;
    volume.intensity_max = volume.header.voxel_max;
    volume.saveOriginAndTransform(header);
    if (BButils.isFunction(callback)) {
      callback(volume);
    }
  }

  function createNifti1Data(header, raw_data) {
    var native_data = null;

    if (header.must_swap_data) {
      VVutils.swapn(
        new Uint8Array(raw_data, header.vox_offset),
        header.bytes_per_voxel
      );
    }

    switch (header.datatype) {
      case 2: // DT_UNSIGNED_CHAR
        // no translation necessary; could optimize this out.
        native_data = new Uint8Array(raw_data, header.vox_offset);
        break;
      case 4: // DT_SIGNED_SHORT
        native_data = new Int16Array(raw_data, header.vox_offset);
        break;
      case 8: // DT_SIGNED_INT
        native_data = new Int32Array(raw_data, header.vox_offset);
        break;
      case 16: // DT_FLOAT
        native_data = new Float32Array(raw_data, header.vox_offset);
        break;
      case 64: // DT_DOUBLE
        native_data = new Float64Array(raw_data, header.vox_offset);
        break;
      // Values above 256 are NIfTI-specific, and rarely used.
      case 256: // DT_INT8
        native_data = new Int8Array(raw_data, header.vox_offset);
        break;
      case 512: // DT_UINT16
        native_data = new Uint16Array(raw_data, header.vox_offset);
        break;
      case 768: // DT_UINT32
        native_data = new Uint32Array(raw_data, header.vox_offset);
        break;
      default:
        // We don't yet support 64-bit, complex, RGB, and float 128 types.
        var error_message = "Unsupported data type: " + header.datatype;
        throw new Error(error_message);
    }

    var d = 0; // Generic loop counter.
    var slope = header.scl_slope;
    var inter = header.scl_inter;

    // According to the NIfTI specification, a slope value of zero means
    // that the data should _not_ be scaled. Otherwise, every voxel is
    // transformed according to value = value * slope + inter
    //
    if (slope !== 0.0) {
      var float_data = new Float32Array(native_data.length);

      for (d = 0; d < native_data.length; d++) {
        float_data[d] = native_data[d] * slope + inter;
      }
      native_data = float_data; // Return the new float buffer.
    }

    VVutils.scanDataRange(native_data, header);

    if (header.order.length === 4) {
      header.order = header.order.slice(1);
    }

    // Incrementation offsets for each dimension of the volume.
    header[header.order[0]].offset =
      header[header.order[1]].space_length *
      header[header.order[2]].space_length;
    header[header.order[1]].offset = header[header.order[2]].space_length;
    header[header.order[2]].offset = 1;

    if (header.time) {
      header.time.offset =
        header.xspace.space_length *
        header.yspace.space_length *
        header.zspace.space_length;
    }

    return native_data;
  }

  var ret = async function (description, callback) {
    var error_message;
    if (description.url) {
      const raw_data = await loader.loadFromURL(description.url, null, {
        result_type: "arraybuffer",
      });
      var header = parseNifti1Header(raw_data);
      var data = createNifti1Data(header, raw_data);
    } else if (description.file) {
      loader.loadFromFile(
        description.file,
        function (nii_data) {
          parseNifti1Header(nii_data, function (header) {
            createNifti1Volume(header, nii_data, callback);
          });
        },
        { result_type: "arraybuffer" }
      );
    } else if (description.source) {
      parseNifti1Header(description.nii_source, function (header) {
        createNifti1Volume(header, description.nii_source, callback);
      });
    } else {
      error_message =
        "invalid volume description.\n" +
        "Description must contain the property 'url' or 'file' or 'nii_source'.";

      throw new Error(error_message);
    }
    return { data: data, header: header };
  };
  return ret;
});
