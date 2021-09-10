// The main BrainBrowser namespace.

define([
  path.join(__dirname, "VolumeViewer"),
  path.join(__dirname, "BButils"),
  path.join(__dirname, "Loader"),
], function (Viewer, BBUtils, Loader) {
  var pjson = require(path.join(__dirname, "../../../package.json"));
  var version = pjson["version"];
  var colorMapUrl = path.join(__dirname, "../resources/gray-scale.txt");
  var volumeDescriptions = [];

  var BrainBrowser = {
    version: version,
    volumeviewer: new Viewer("brainbrowser", colorMapUrl, volumeDescriptions),
    utils: BBUtils,
    loader: Loader,
  };
  return BrainBrowser;
});
