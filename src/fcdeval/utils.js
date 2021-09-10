const moment = require("moment");
const { BrowserWindow, dialog } = require("@electron/remote");
const glob = require("glob");
const path = require("path");
const parse = require("csv-parse");
const fs = require("fs");
const zlib = require("zlib");
const { throwDeprecation } = require("process");

module.exports = function () {
  // go from one tab to the next tab (next as in position in html doc)
  this.nextContent = function (event) {
    let elem = event.currentTarget;
    let id = $(elem).data("id");
    while (id === undefined) {
      elem = elem.parentElement;
      id = $(elem).data("id");
    }
    if ($('[data-id="' + id + '"]').hasClass("show")) {
      let nextId = $(elem).data("id") + 1;
      $('[data-id="' + id + '"]').removeClass("show");
      //$('[data-id="' + id + '"]').css("outline", "1px solid black");
      $('[data-id="' + nextId + '"]')
        .addClass("show")
        .trigger("show");
      //$('[data-id="' + nextId + '"]').css("outline", "2px solid red");
    }
  };
  // go from one tab to the previous tab (previous as in position in html doc)
  this.previousContent = function (event) {
    let elem = event.currentTarget;
    let id = $(elem).data("id");
    while (id === undefined) {
      elem = elem.parentElement;
      id = $(elem).data("id");
    }
    if ($('[data-id="' + id + '"]').hasClass("show")) {
      let prevId = $(elem).data("id") - 1;
      $('[data-id="' + id + '"]').removeClass("show");
      //$('[data-id="' + id + '"]').css("outline", "1px solid black");
      $('[data-id="' + prevId + '"]')
        .addClass("show")
        .trigger("show");
      //$('[data-id="' + prevId + '"]').css("outline", "2px solid red");
    }
  };
  // initialize volume viewer
  this.initViewer = function (viewer) {
    viewer.KeyActiveROI = "initial";
    viewer.addRoi("initial");
    viewer.addRoi("revised");
  };
  // advance position in the subject array to load the next subject or switch between initial and review list
  this.advancePosition = function () {
    let currentPosition = window.user.currentPosition;
    if (currentPosition.list == "initial_list") {
      if (++currentPosition.index >= Object.keys(window.subjects).length) {
        currentPosition.list = "review_list";
        currentPosition.index = -1;
        return advancePosition();
      } else {
        window.currentSubject =
          window.subjects[window.user.initial_list[currentPosition.index]];
      }
      //advance normally
    } else {
      if (++currentPosition.index >= Object.keys(window.subjects).length) {
        //finish
        return -999;
      } else {
        //load subject if current position id is in review_ids otherwise advance further
        if (
          window.user.review_ids.includes(
            window.user.review_list[currentPosition.index]
          )
        ) {
          //load the subject
          window.currentSubject =
            window.subjects[window.user.review_list[currentPosition.index]];
        } else {
          //continue
          return advancePosition();
        }
      }
    }
    //reset values
    document.getElementById("t1").checked = true;
    document.getElementById("flair").checked = false;
    window.volumeDescriptions = null;
    initViewer(window.BrainBrowser.volumeviewer);
    document.getElementById("certaintyProbPat").value = "5";
    document.getElementById("certaintyProbPatOutput").value = "";
    document.getElementById("certaintyRoi").value = "5";
    document.getElementById("certaintyRoiOutput").value = "";

    return currentPosition.index;
  };
  // jump to another content, not the next tab
  this.targetContent = function (event, targetID, nextPatient = false) {
    let id = $(event.currentTarget.parentElement).data("id");

    if (window.user.currentPosition.index === -999) {
      targetID = 999;
    }

    if (nextPatient) {
      let oldList = window.user.currentPosition.list;
      let nextInd = advancePosition();
      if (nextInd == -999) {
        targetID = 999;
        window.user.currentPosition.index = -999;
      }
      if (oldList !== window.user.currentPosition.list) {
        //display intermediate info that now its review time
        targetID = 30;
      }
    }

    if ($('[data-id="' + id + '"]').hasClass("show")) {
      $('[data-id="' + id + '"]').removeClass("show");
      //$('[data-id="' + id + '"]').css("outline", "1px solid black");
      $('[data-id="' + targetID + '"]')
        .addClass("show")
        .trigger("show");
      //$('[data-id="' + targetID + '"]').css("outline", "2px solid red");
    }
    this.storeUserData();
  };
  // if initial list ask for certainty otherwise jump straight to lesion detection
  this.handleOpenPatient = function (event) {
    if (window.user.currentPosition.list == "initial_list") {
      nextContent(event);
    } else {
      targetContent(event, 4);
    }
  };
  // store userdata and jump to initial tab
  this.finish = function () {
    storeUserData();
    let elem = $(".show");
    elem.removeClass("show");
    //elem.css("outline", "1px solid black");
    $('[data-id="' + 1 + '"]')
      .addClass("show")
      .trigger("show");
    //$('[data-id="' + 1 + '"]').css("outline", "2px solid red");
  };
  // when revision is clicked, add this to user data
  this.revision = function (event) {
    this.BrainBrowser.volumeviewer.KeyActiveROI = "revised";
    window.currentResults["revision"] = true;
    document.getElementById("certaintyRoi").value = "5";
    document.getElementById("certaintyRoiOutput").value = "";
    this.previousContent(event);
  };
  // document time, id, position in evaluation of any button press with class 'action'
  this.addActivityPoint = function (event) {
    if (window.user === undefined) {
      return;
    }
    let id_ = event.target.id;
    window.user.actions.push({
      id: id_,
      time: moment().valueOf(),
      position: JSON.parse(JSON.stringify(window.user.currentPosition)),
    });
    //store userdata after every button press
    storeUserData();
  };
  // load all users available under path/users
  this.loadUsers = function (path_) {
    files = glob.sync(path_ + "/users/*");

    if (files.length == 0) {
      return [];
    }
    ret = [];
    for (let i = 0; i < files.length; i++) {
      ret.push(path.basename(files[i]));
    }
    return ret;
  };
  // if a new user is added, reload users
  this.reloadUsers = function (event) {
    let path_ = document.getElementById("datasetPath").value;
    let users = (window.users = loadUsers(path_));

    let options = "";
    for (let i = 0; i < users.length; i++) {
      //TODO safety check if *_data.json file exists
      options += '<option value="' + users[i] + '" />';
    }
    document.getElementById("userIds").innerHTML = options;
  };
  // already fill in optional params when user exists
  this.preloadUserData = function () {
    let dataDir = document.getElementById("datasetPath").value;
    let userId = document.getElementById("userId").value;
    let userPath = path.join(dataDir, "users", userId);

    if (window.users.includes(userId)) {
      let user = require(path.join(userPath, userId + "_data.json"));
      document.getElementById("expRad").value = user.expRad;
      document.getElementById("expNRad").value = user.expNRad;
      document.getElementById("expFCDvalue").value = user.expFCDvalue;
      document.getElementById("position").value = user.position;
      this.outputUpdateExpFCD(user.expFCDvalue);
    }
  };
  // load the data of a specific user
  this.loadUserData = function (event) {
    let dataDir = document.getElementById("datasetPath").value;
    if (dataDir === "") {
      alert("Bitte waehlen Sie einen Datensatz.");
      return;
    }
    let userId = document.getElementById("userId").value;
    if (userId == "") {
      alert("Please provide user ID.");
    } else {
      userPath = path.join(dataDir, "users", userId);
      if (window.users.includes(userId)) {
        //load user
        let user = (window.user = require(path.join(
          userPath,
          userId + "_data.json"
        )));
        //init currentSubject in window namespace
        if (user.currentPosition.index === -999) {
          alert("Sie haben schon alle Subjekte bewertet. Vielen Dank!");
          user.actions.push({
            id: "start",
            time: moment().valueOf(),
            position: JSON.parse(JSON.stringify(window.user.currentPosition)),
          });

          targetContent(event, 999, false);
          return;
        }
        let currentSub = (window.currentSubject =
          window.subjects[
            user[user.currentPosition.list][user.currentPosition.index]
          ]);
        // init current results
        // currently if app is closed before a subject has been fully worked through, existing results for that subject are overwritten and need to be redone
        window.currentResults = user.results[currentSub["participant_id"]] = {};
      } else {
        //create user

        let user = (window.user = new User(userId));
        //TODO make random lists
        let initial_list = generateRandomList(1);
        let review_list = generateRandomList(2);
        user.initial_list = initial_list;
        user.review_list = review_list;

        fs.mkdirSync(userPath, { recursive: true });

        fs.writeFileSync(
          path.join(userPath, "initial_list.json"),
          JSON.stringify(initial_list)
        );
        fs.writeFileSync(
          path.join(userPath, "review_list.json"),
          JSON.stringify(review_list)
        );
        // initially call store user data to create user
        storeUserData();
      }
      //start the action by pushing the start time and position and open next window
      user.actions.push({
        id: "start",
        time: moment().valueOf(),
        position: JSON.parse(JSON.stringify(window.user.currentPosition)),
      });
      user.expRad = document.getElementById("expRad").value;
      user.expNRad = document.getElementById("expNRad").value;
      user.expFCDvalue = document.getElementById("expFCDvalue").value;
      user.position = document.getElementById("position").value;
      targetContent(event, 2, false);
    }
  };
  // store the data of a specific user
  this.storeUserData = function () {
    if (window.user === undefined) {
      return;
    }
    let dataDir = document.getElementById("datasetPath").value;
    let userId = document.getElementById("userId").value;
    userPath = path.join(dataDir, "users", userId);

    fs.writeFileSync(
      path.join(userPath, userId + "_data.json"),
      JSON.stringify(window.user)
    );
  };
  // for shuffeling ids around
  this.shuffle = function (array) {
    var currentIndex = array.length,
      randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
    return array;
  };
  // return the subject ids in random order
  this.generateRandomList = function () {
    return shuffle(Object.keys(window.subjects));
  };
  // load the information from the participants.tsv into an object with keys equal to the 'participant_id's
  this.loadDataset = function () {
    let datasetDir = path.join(
      document.getElementById("datasetPath").value,
      "subjects"
    );
    const data = [];
    fs.createReadStream(path.join(datasetDir, "participants.tsv"))
      .pipe(parse({ delimiter: "\t" }))
      .on("data", (r) => {
        data.push(r);
      })
      .on("end", () => {
        subjectsArr = [];
        headers = data[0];
        for (let i = 1; i < data.length; i++) {
          arr = data[i];
          sub = {};
          for (let j = 0; j < headers.length; j++) {
            sub[headers[j].trim()] = arr[j].trim();
          }
          subjectsArr.push(sub);
        }

        subjects = window.subjects = {};
        for (let n = 0; n < subjectsArr.length; n++) {
          subjects[subjectsArr[n]["participant_id"]] = subjectsArr[n];
        }
      });
  };
  // handle the selection of a file containing subjects and users
  this.openDatasetFile = function () {
    const importFilePath = dialog.showOpenDialogSync(
      BrowserWindow.getFocusedWindow(),
      {
        title: "Select Dataset File:",
        properties: ["openDirectory"],
      }
    );
    if (!importFilePath) {
      return;
    }
    let label = document.getElementById("datasetPath");
    label.innerText = importFilePath[0];
    label.value = importFilePath[0];

    reloadUsers();
    loadDataset();
  };
  // display the subject id the user should load
  this.displayCurrentSubjectId = function () {
    let inputElem = document.getElementById("patientID");
    let user = window.user;
    let currentSub = (window.currentSubject =
      window.subjects[
        user[user.currentPosition.list][user.currentPosition.index]
      ]);
    let currentStudyId = currentSub["study_id"];
    inputElem.innerText = currentStudyId;
    //dont reinitialize results when reviewing
    if (user.currentPosition.list == "initial_list") {
      window.currentResults = window.user.results[
        currentSub["participant_id"]
      ] = {};
      window.currentResults["revision"] = false;
    } else {
      window.currentResults = user.results[currentSub["participant_id"]];
    }
    // load subject volumes already just in case
    initializeLesionDetection();
  };
  // check if the certainty value matches the groundtruth
  this.checkCertaintyChoice = function (event) {
    let certainty = document.getElementById("certaintyProbPat").value;
    if (certainty == 5) {
      alert("Bitte bewegen Sie den Slider von seiner Anfangsposition.");
      return;
    }
    window.user.results[window.currentSubject["participant_id"]]["certainty"] =
      certainty;
    let isPatient = window.currentSubject["patient"] == 1;
    window.currentResults["certainty"] = certainty;
    //if subject is patient and choice is patient -> lesiondetection
    // ---------"------------------------ proband -> save to revision ids
    // if subject is proband -> display right/wrong
    if (isPatient) {
      if (certainty > 5) {
        //if subject is patient and choice is patient -> lesiondetection
        targetContent(event, 4, false);
      } else {
        //if subject is patient and choice is proband -> save to revision ids
        window.user.review_ids.push(window.currentSubject.participant_id);
        window.currentResults["missed"] = true;
        targetContent(event, 10, false);
      }
    } else {
      if (certainty > 5) {
        // if subject is proband and choice is patient -> display wrong
        targetContent(event, 10, false);
      } else {
        // if subject is proband and choice is patient -> display right
        targetContent(event, 20, false);
      }
    }
  };
  // load volumes etc.
  this.initializeLesionDetection = function () {
    //only load volumes if they have not been previously loaded
    //if (window.volumeDescriptions == null) {
    //load user specific volumes
    let path_ = document.getElementById("datasetPath").value;
    let volumeBasePath = path.join(
      path_,
      "subjects",
      window.currentSubject.participant_id,
      "anat"
    );

    files = glob.sync(volumeBasePath + "/*.nii*");
    t1Path = "";
    flairPath = "";
    for (let i = 0; i < files.length; i++) {
      if (files[i].includes("T1w.nii")) {
        t1Path = files[i];
      } else if (files[i].includes("FLAIR.nii")) {
        flairPath = files[i];
      }
    }

    window.volumeDescriptions = [
      {
        type: "nifti1",
        url: t1Path,
        name: "T1",
        template: {
          type: "volume",
          element_id: "volume-ui-template",
          viewer_insert_class: "volume-viewer-display",
        },
      },
      {
        type: "nifti1",
        url: flairPath,
        name: "FLAIR",
        template: {
          type: "volume",
          element_id: "volume-ui-template",
          viewer_insert_class: "volume-viewer-display",
        },
      },
    ];

    window.BrainBrowser.volumeviewer.loadVolumes(volumeDescriptions);
    window.BrainBrowser.volumeviewer.setActiveVolume("FLAIR");
    switchActiveVolume();
    //}
  };
  // display the additional modalities for potential revision
  this.fillAdditionalInformation = function () {
    document.getElementById("semiology").innerText =
      window.currentSubject.semiology;
    document.getElementById("ictaleeg").innerText =
      window.currentSubject.eeg_ictal;
    document.getElementById("interictaleeg").innerText =
      window.currentSubject.eeg_interictal;
    document.getElementById("neuropsych").innerText =
      window.currentSubject.neuropsych;
  };
  // enable switching between FLAIR and T1w
  this.switchActiveVolume = function (name) {
    let images = document.getElementsByName("image");
    let image = "T1";
    for (let i of images) {
      if (i.checked) {
        image = i.value;
      }
    }
    window.BrainBrowser.volumeviewer.setActiveVolume(image);
  };
  // handle manual position input
  this.updateBrowserPosition = function () {

    let activeVolume =
      window.BrainBrowser.volumeviewer.volumes[
        window.BrainBrowser.volumeviewer.active_volume_idx
      ];
    activeVolume.position["xspace"] = parseInt(
      document.getElementById("xspace").value
    );
    activeVolume.position["yspace"] = parseInt(
      document.getElementById("yspace").value
    );
    activeVolume.position["zspace"] = parseInt(
      document.getElementById("zspace").value
    );

    Object.values(window.BrainBrowser.volumeviewer.display.panels).forEach(
      function (panel) {
        panel.updateSlice();
      }
    );
  };
  // store rois and vertainty to user
  this.saveLesionInformation = function () {
    let viewer = window.BrainBrowser.volumeviewer;
    let activeVolName = viewer.active_volume_name;
    window.currentResults[activeVolName] =
      window.currentResults[activeVolName] || {};
    if (window.BrainBrowser.volumeviewer.KeyActiveROI == "revised") {
      window.currentResults[activeVolName]["revised_roi"] = JSON.parse(
        JSON.stringify(window.BrainBrowser.volumeviewer.ROIs["revised"])
      );
      window.currentResults[activeVolName]["revised_position"] = JSON.parse(
        JSON.stringify(
          window.BrainBrowser.volumeviewer.volumes[viewer.active_volume_idx]
            .position
        )
      );
      window.currentResults[activeVolName]["revised_roi_certainty"] =
        document.getElementById("certaintyRoi").value;
    } else {
      window.currentResults[activeVolName]["initial_position"] = JSON.parse(
        JSON.stringify(
          window.BrainBrowser.volumeviewer.volumes[viewer.active_volume_idx]
            .position
        )
      );
      window.currentResults[activeVolName]["initial_roi"] = JSON.parse(
        JSON.stringify(window.BrainBrowser.volumeviewer.ROIs["initial"])
      );
      window.currentResults[activeVolName]["initial_certainty"] =
        document.getElementById("certaintyRoi").value;
    }
  };

  this.outputUpdateExpFCD = function (num) {
    let newVal = "";
    switch (num) {
      case "0":
        newVal = "Keine";
        break;
      case "1":
        newVal = "Selten";
        break;
      case "2":
        newVal = "Gelegentlich";
        break;
      case "3":
        newVal = "Haeufig";
        break;
      default:
        newVal = "Keine";
        break;
    }
    document.querySelector("#expFCDoutput").innerText = newVal;
  };

  this.outputUpdateCertaintyProbPat = function (num) {
    document.querySelector("#certaintyProbPatOutput").value = num;
  };

  this.outputUpdateCertaintyRoi = function (num) {
    document.querySelector("#certaintyRoiOutput").value = num;
  };

  this.lesionDetectionNext = function (event) {
    let certainty = document.getElementById("certaintyRoiOutput").value;
    if (certainty === "") {
      alert("Bitte geben Sie an wie sicher Sie bei der Detektion sind.");
    } else {
      nextContent(event);
    }
  };

  this.pause = function () {
    if (window.paused) {
      window.paused = false;
      $(".show").removeClass("disabledContent");
      document.getElementById("pause").innerHTML = "Pausieren";
    } else {
      window.paused = true;
      $(".show").addClass("disabledContent");
      document.getElementById("pause").innerHTML = "Fortfahren";
    }
  };
};
