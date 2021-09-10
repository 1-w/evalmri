const $ = (jQuery = require("jquery"));
require("jquery-ui-dist/jquery-ui");
require("amd-loader");
const fs = require("fs");
const path = require("path");
const storage = require("electron-json-storage");
require(path.join(__dirname, "brain_display/bbb/utils"))();

$(function () {
  require(path.join(__dirname, "/brain_display/bbb/utils.js"))();

  // set the theme on initial load
  setTheme("theme-normal");

  window.BrainBrowser = BrainBrowser = require(path.join(
    __dirname,
    "brain_display/bbb/BrainBrowser"
  ));

  // load dataset (TODO from server)
  const defaultDataPath = storage.getDefaultDataPath();
  console.log(defaultDataPath);

  loadDevComments();

  addAutoresize(document);

  loadDataset();
  // dont allow saving before a subject has been loaded/created
  disableElement("datasetInteraction");
  addIDInputListeners();

  var viewer = BrainBrowser.volumeviewer;
  window.IDCounter = 9999;

  document.getElementById("reset").addEventListener("click", (e) => {
    viewer.resetView();
  });
  document.getElementById("remove").addEventListener("click", (e) => {
    viewer.deleteROI();
  });
  document.getElementById("copy").addEventListener("click", (e) => {
    viewer.copyROI();
  });
  document.getElementById("paste").addEventListener("click", (e) => {
    viewer.pasteROI();
  });
  const elements = document.getElementsByClassName("withRoi");
  for (let elem of elements) {
    addRoiChangeListener(elem);
  }

  var atlasElems = document.getElementsByClassName("atlas");
  for (let elem of atlasElems) {
    addVolumeChangeListener(elem);
  }

  var atlasInputs = document.getElementsByClassName("atlas-input");
  for (let elem of atlasInputs) {
    addLabelInputListener(elem);
    addAutoComplete(elem);
  }
});
