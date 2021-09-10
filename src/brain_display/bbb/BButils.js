define(function () {
  return {
    webglExtensionAvailable: function (name) {
      if (!BrainBrowser.WEBGL_ENABLED) {
        return false;
      }

      var canvas = document.createElement("canvas");
      var gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      return !!gl.getExtension(name);
    },

    webGLErrorMessage: function () {
      var elem;
      var text =
        'BrainBrowser requires <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">WebGL</a>.<br/>';
      text += window.WebGLRenderingContext
        ? "Your browser seems to support it, but it is <br/> disabled or unavailable.<br/>"
        : "Your browser does not seem to support it.<br/>";
      text +=
        'Test your browser\'s WebGL support <a href="http://get.webgl.org/">here</a>.';

      elem = document.createElement("div");
      elem.id = "webgl-error";
      elem.innerHTML = text;

      return elem;
    },

    isFunction: function (object) {
      return object instanceof Function || typeof object === "function";
    },

    isNumeric: function (n) {
      return !isNaN(parseFloat(n));
    },

    createDataURL: function (data, mime_type) {
      if (!window.URL || !window.URL.createObjectURL) {
        throw new Error(
          "createDataURL requires URL.createObjectURL which does not seem to be available is this browser."
        );
      }

      return window.URL.createObjectURL(
        new Blob([data], { type: mime_type || "text/plain" })
      );
    },

    getWorkerImportURL: function () {
      var worker_dir = BrainBrowser.config.get("worker_dir");
      var import_url = document.location.origin + "/" + worker_dir;
      var doc_href = document.location.href;
      var slash_index = doc_href.lastIndexOf("/");
      if (slash_index >= 0) {
        import_url = doc_href.substring(0, slash_index + 1) + worker_dir;
      }
      return import_url;
    },

    min: function () {
      var array = Array.prototype.slice.call(arguments);
      array =
        array.length === 1 && BrainBrowser.utils.isNumeric(array[0].length)
          ? array[0]
          : array;

      var min = array[0];
      var i, count;
      for (i = 1, count = array.length; i < count; i++) {
        if (array[i] < min) min = array[i];
      }
      return min;
    },

    max: function () {
      var array = Array.prototype.slice.call(arguments);
      array =
        array.length === 1 && BrainBrowser.utils.isNumeric(array[0].length)
          ? array[0]
          : array;

      var max = array[0];
      var i, count;
      for (i = 1, count = array.length; i < count; i++) {
        if (array[i] > max) max = array[i];
      }
      return max;
    },

    getOffset: function (element) {
      var top = 0;
      var left = 0;
      while (element.offsetParent) {
        top += element.offsetTop;
        left += element.offsetLeft;
        element = element.offsetParent;
      }
      //add final fixed div offset
      top += element.offsetTop;
      left += element.offsetLeft;

      return { top: top, left: left };
    },
  };
});
