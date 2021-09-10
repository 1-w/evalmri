define([
  path.join(__dirname, "BButils"),
  path.join(__dirname, "Colormap"),
], function (utils, Colormap) {
  var ret = {
    checkCancel: function (options) {
      options = options || {};
      if (utils.isFunction(options)) {
        options = { test: options };
      }

      var cancelTest = options.test;
      var cancelCleanup = options.cleanup;
      var cancelled = false;

      if (cancelTest && cancelTest()) {
        cancelled = true;
        if (cancelCleanup) cancelCleanup();
      }

      return cancelled;
    },
    loadFromURL: async function (url, callback, options) {
      options = options || {};
      var request = new XMLHttpRequest();
      var result_type = options.result_type;
      var status;
      var parts = url.split("/");
      var filename = parts[parts.length - 1];

      const response = await fetch(url);

      //check if .gz file
      if (result_type == "text") {
        return await response.text();
      } else {
        const data = await response.arrayBuffer();

        try {
          const pako = require("pako");

          /* See if the data can be inflated.
           */
          var unzipped = pako.inflate(data);
          result = unzipped.buffer;
          return result;
        } catch (e) {
          /* pako probably didn't recognize this as gzip.
           */
        }
        // request.open("GET", url);

        return data;
      }
    },

    loadFromFile: function (file_path, callback, options) {
      if (file_path.length === 0) {
        return;
      }

      options = options || {};
      var result_type = options.result_type;

      var reader = new FileReader();
      var parts = file_path.split("/");
      var filename = parts[parts.length - 1];

      reader.file = file_path;

      reader.onloadend = function (event) {
        var result = event.target.result;
        try {
          /* See if the data can be inflated.
           */
          var unzipped = pako.inflate(result);
          result = unzipped.buffer;
        } catch (e) {
          /* pako probably didn't recognize this as gzip.
           */
        } finally {
          /* At this point, we have a binary hunk of data that may
           * have been inflated.
           */
          if (result_type !== "arraybuffer") {
            /* The caller requested the data as a string, so we have
             * to perform an additional step to convert the
             * arraybuffer we have into the string the caller wants.
             */
            if (typeof TextDecoder !== "function") {
              /* Use the slightly slower blob-to-filereader conversion
               * to string.
               */
              var blob = new Blob([result]);
              var rdr2 = new FileReader();
              rdr2.onload = function (event) {
                callback(event.target.result, filename, options);
              };
              rdr2.readAsText(blob);
            } else {
              /* Simpler but newer conversion using TextDecoder, this
               * might not work on some browsers.
               */
              var dv = new DataView(result);
              var decoder = new TextDecoder();
              result = decoder.decode(dv);
              callback(result, filename, options);
            }
          } else {
            /* The caller requested an arraybuffer, so we just pass it
             * back now.
             */
            callback(result, filename, options);
          }
        }
      };

      reader.onerror = function () {
        var error_message = "error reading file: " + filename;

        // BrainBrowser.events.triggerEvent("error", { message: error_message });
        throw new Error(error_message);
      };
      let file = new File(file_path);
      reader.readAsArrayBuffer(file);
    },

    loadColorMapFromURL: async function (url, callback, options) {
      options.result_type = "text";
      const data = await this.loadFromURL(url, null, options);
      const cmap = Colormap(data, options);
      // callback(BrainBrowser.createColorMap(data, options), filename, options);
      return cmap;
    },

    loadColorMapFromFile: function (file_input, callback, options) {
      this.loadFromFile(
        file_input,
        function (data, filename, options) {
          callback(
            BrainBrowser.createColorMap(data, options),
            filename,
            options
          );
        },
        options
      );
    },
  };
  return ret;
});
