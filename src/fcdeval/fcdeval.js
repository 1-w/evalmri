const $ = (jQuery = require("jquery"));
require("jquery-ui-dist/jquery-ui");
require("amd-loader");
const fs = require("fs");
const path = require("path");
const storage = require("electron-json-storage");
require(path.join(__dirname, "fcdeval/utils"))();
const User = require(path.join(__dirname, "fcdeval/user"));
const { app } = require("@electron/remote");

$(function () {
  require(path.join(__dirname, "/fcdeval/utils.js"))();

  // INIT thr brainbrowser
  window.BrainBrowser = BrainBrowser = require(path.join(
    __dirname,
    "brain_display/bbb/BrainBrowser"
  ));
  // add two rois to the brain viewer
  let viewer = BrainBrowser.volumeviewer;
  initViewer(viewer);

  //load datasetPath from storage
  storage.get("datasetPath", (error, data) => {
    if (error) {
      throw error;
    }
    if (data.length !== 0) {
      window.users = [];
    } else {
      document.getElementById("dataDir").value = data;
      reloadUsers();
    }
  });
  //add functions to the roi button controls
  document.getElementById("resetView").addEventListener("click", (e) => {
    viewer.resetView();
  });
  document.getElementById("removeRoi").addEventListener("click", (e) => {
    viewer.deleteROI();
  });
  //add timestamping to every button
  $("button.action").on("click", addActivityPoint);

  //add user loading if dataset path changes
  $("#start").on("click", loadUserData);

  //add div specific functions
  $("#welcome").on("show", reloadUsers);
  $("#inputSubject").on("show", displayCurrentSubjectId);
  $("#lesionDetection").on("show", initializeLesionDetection);
  $("#clinicalInformation").on("show", fillAdditionalInformation);
  $("#locateLesionNext").on("click", saveLesionInformation);
  $("#finish").on("show", storeUserData);

  //display version
  document.getElementById("version").innerText = app.getVersion();
});
