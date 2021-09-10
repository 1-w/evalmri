const moment = require("moment");
const { BrowserWindow, dialog } = require("@electron/remote");
module.exports = function () {
  ///
  //  ***functions affecting html***
  ///
  // set a given theme/color-scheme
  this.setTheme = function (themeName) {
    localStorage.setItem("theme", themeName);
    document.documentElement.className = themeName;
  };
  // toggle between light and dark theme
  this.toggleTheme = function () {
    if (localStorage.getItem("theme") === "theme-bastianium") {
      setTheme("theme-normal");
      document.getElementById("theme-button").firstChild.data = "Normal";
    } else {
      setTheme("theme-bastianium");
      document.getElementById("theme-button").firstChild.data = "Bastianium";
    }
  };
  // handle click on modality tab, open the content div and load ROIs
  this.openModality = function (targetElem) {
    // Declare all variables
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
      tabcontent[i].className = tabcontent[i].className.replace(" active", "");
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    const elem = document.getElementById(targetElem.getAttribute("target"));
    elem.style.display = "flex";
    elem.className += " active";
    targetElem.className += " active";
    const elemsWithRoi = elem.querySelectorAll(".withRoi");
    var show = elemsWithRoi.length != 0;
    if (show) {
      this.enableElement("brainview");
      this.changeBackground(elemsWithRoi[0]);
      let elemsWithRegion = elemsWithRoi[0].querySelectorAll(".brainRegion");
      BrainBrowser.volumeviewer.changeActiveRoi(elemsWithRegion[0].id);
      BrainBrowser.volumeviewer.setSelectedLabels(elemsWithRegion[0]);
    } else {
      if (elem.classList && elem.classList.contains("withRoi")) {
        this.enableElement("brainview");
        this.changeBackground(elem);
        let elemsWithRegion = elem.querySelectorAll(".brainRegion");
        BrainBrowser.volumeviewer.changeActiveRoi(elemsWithRegion[0].id);
        BrainBrowser.volumeviewer.setSelectedLabels(elemsWithRegion[0]);
      } else {
        BrainBrowser.volumeviewer.changeActiveRoi("");
        const elemsWithRegion = elem.querySelectorAll(".brainRegion");
        const elemsWithAtlas = elem.querySelectorAll(".atlas");
        if (elemsWithRegion.length != 0) {
          this.enableElement("brainview");
          this.changeBackground(elemsWithAtlas[0]);
        } else {
          this.changeBackground();
          this.disableElement("brainview");
        }
      }
    }

    const areas = elem.querySelectorAll("textarea");
    $(areas).trigger("input");
    const esc = $.Event("keydown", { keyCode: 27 });
    $(areas).trigger(esc);
  };
  // handle surgery checkboxes checking/unchecking
  this.handlePlanned = function () {
    if (document.getElementById("planCheckbox").checked === false) {
      document.getElementById("procedureCheckbox").style.display = "none";
      document.getElementById("procedureCheckboxLabel").style.display = "none";
      document.getElementById("plan").remove();
      if (document.getElementById("procedureCheckbox").checked) {
        document.getElementById("procedureCheckbox").checked = false;
        document.getElementById("procedure").remove();
      }
    } else {
      document.getElementById("procedureCheckbox").style.display = "initial";
      document.getElementById("procedureCheckboxLabel").style.display =
        "initial";
      return this.addTemplate(
        "plan-template",
        document.getElementById("surgicalContainer")
      );
    }
  };
  // handle surgery checkbox related content display
  this.handleProcedure = function () {
    if (document.getElementById("procedureCheckbox") === false) {
      document.getElementById("procedure").remove();
    } else {
      return this.addTemplate(
        "procedure-template",
        document.getElementById("surgicalContainer")
      );
    }
  };
  // add description template for seizure type
  this.addSeizureType = function () {
    const elem = document.querySelector("#seizureTypes");
    let typeElem = this.addTemplate("seizureType-template", elem);
    let id = typeElem.parentElement.children.length;
    let descID = typeElem.querySelector("#typeID");
    if (descID) {
      descID.value = "Typ " + id;
      descID.id = "seizuretype_" + window.IDCounter;
    }
    return typeElem;
  };
  // add description template for seizure incident
  this.addSeizure = function (elem) {
    let descElem = this.addTemplate("seizure-template", elem);
    //let semiElem = addTemplate("semiology-template", "seizuretypes");
    let id = descElem.parentElement.children.length;
    //semiElem.id = "description_" + window.IDCounter;
    let nameID = descElem.querySelector("#nameID");
    if (nameID) {
      nameID.value = "Anfall " + id;
      nameID.id = "seizuretype_" + window.IDCounter;
    }

    window.IDCounter++;
    return descElem;
  };
  //also seizure description element
  this.removeSeizureType = function (elem) {
    let id = elem.id;
    let seizures = elem.querySelector("#seizures");
    for (let e of seizures.childNodes) {
      this.removeSeizure(e);
    }
    let regions = elem.querySelectorAll(".brainRegion");
    for (let region of regions) {
      BrainBrowser.volumeviewer.removeRoi(region.id);
    }
    elem.remove();
  };
  //also seizure description element
  this.removeSeizure = function (elem) {
    let id = elem.id;
    let regions = elem.querySelectorAll(".brainRegion");
    for (let region of regions) {
      BrainBrowser.volumeviewer.removeRoi(region.id);
    }
    elem.remove();
  };
  //add all listeners and enable brain view
  this.addBrainViewInteraction = function (elem) {
    const elemsWithRoi = elem.querySelectorAll(".withRoi");
    if (elem.classList.contains("withRoi")) {
      this.addRoiChangeListener(elem);
    } else {
      for (let e of elemsWithRoi) {
        this.addRoiChangeListener(e);
      }
    }
    const elemsWithAtlas = elem.querySelectorAll(".atlas");
    if (elem.classList.contains("atlas")) {
      this.addVolumeChangeListener(elem);
    } else {
      for (let e of elemsWithAtlas) {
        this.addVolumeChangeListener(e);
      }
    }

    const hyps = elem.querySelectorAll(".brainRegion");
    const labels = elem.querySelectorAll(".brainRegionLabel");
    for (let i = 0; i < hyps.length; i++) {
      const hyp = hyps[i];
      const label = labels[i];
      hyp.id = hyp.id + window.IDCounter;
      label.setAttribute("for", hyp.id);
      BrainBrowser.volumeviewer.addRoi(hyp.id);
      BrainBrowser.volumeviewer.addSelectedLabels(hyp.id);
      this.enableElement("brainview");
      this.addLabelInputListener(hyp);
      addAutoComplete(hyp);
      BrainBrowser.volumeviewer.changeActiveRoi(hyp.id);
      window.IDCounter++;
    }
  };
  // add autoresize to all textareas in container
  this.addAutoresize = function (container) {
    const areas = container.querySelectorAll("textarea");

    $(areas)
      .each(function () {
        this.setAttribute("style", "height:auto;overflow-y:hidden;");
        //this.style.height = this.scrollHeight + "px";
      })
      .on("input", function () {
        this.style.height = "auto";
        if (this.scrollHeight == 0) {
          this.style.height = "16px";
        } else {
          this.style.height = this.scrollHeight + "px";
        }
      });

    // const txHeight = 16;
    // const tx = container.getElementsByTagName("textarea");
    // for (let i = 0; i < tx.length; i++) {
    //   if (tx[i].value == "") {
    //     tx[i].setAttribute(
    //       "style",
    //       "height:" + txHeight + "px;overflow-y:hidden;"
    //     );
    //   } else {
    //     tx[i].setAttribute(
    //       "style",
    //       "height:" + 2 * txHeight + "px;overflow-y:hidden;"
    //     );
    //   }
    // }
  };
  // add element from template
  this.addTemplate = function (templateName, container) {
    const t = document.getElementById(templateName);
    const clone = t.content.firstElementChild.cloneNode(true);
    let child = container.appendChild(clone);
    addAutoresize(child);

    this.addBrainViewInteraction(child);
    return child;
  };
  //change background of imaging element
  this.changeBackground = function (elem) {
    let bg = "mni";
    if (elem) {
      bg = elem.getAttribute("background");
    }
    BrainBrowser.volumeviewer.setActiveVolume(bg);
  };
  //handle MRT modalities background
  this.alterBackground = function (elem) {
    elem.parentElement.setAttribute("background", elem.value);
    this.changeBackground(elem.parentElement);
  };
  // add a listener for changing the active ROI to an element
  this.addRoiChangeListener = function (elem) {
    elem.addEventListener("click", (e) => {
      //e.preventDefault();
      //const targetName = elem.getAttribute('target');
      // try to find closts region to click
      let hyp = (brainRegionContainer = e.srcElement);
      if (!brainRegionContainer.classList.contains("brainRegion")) {
        hyp = brainRegionContainer.querySelector(".brainRegion");
        while (!hyp) {
          brainRegionContainer = brainRegionContainer.parentElement;
          hyp = brainRegionContainer.querySelector(".brainRegion");
        }
      }

      if (!hyp) {
        const activeContent = document.querySelector(".tabcontent.active");
        hyp = activeContent.querySelector(".brainRegion");
      }
      if (hyp) {
        BrainBrowser.volumeviewer.changeActiveRoi(hyp.id);
      } else {
        console.log("click event fired but no brain region element found!");
      }
    });
  };
  // add a listener for changing the background volume to an element
  this.addVolumeChangeListener = function (elem) {
    elem.addEventListener("click", (e) => {
      //e.preventDefault();
      var elem = e.currentTarget;
      var background = elem.getAttribute("background");
      BrainBrowser.volumeviewer.setActiveVolume(background);
    });
  };
  // add a listener for setting the selected labels to an element
  this.addLabelInputListener = function (elem) {
    elem.addEventListener("keyup", (e) => {
      //e.preventDefault();
      let elem1 = e.target;
      console.log(elem1.id);
      BrainBrowser.volumeviewer.setSelectedLabels(elem1);
    });
  };
  //add autocomplete for atlas inputs from labels.xml file
  this.addAutoComplete = function (elem) {
    function split(val) {
      return val.split(/;\s*/);
    }
    function extractLast(term) {
      return split(term).pop();
    }
    $(elem).autocomplete({
      minLength: 0,
      source: function (request, response) {
        // delegate back to autocomplete, but extract the last term
        const lastitem = extractLast(request.term);
        if (this.element[0] === document.activeElement) {
          response(
            jQuery.ui.autocomplete.filter(
              BrainBrowser.volumeviewer.origLabels,
              lastitem
            )
          );
        }
      },
      focus: function () {
        // prevent value inserted on focus
        return false;
      },
      select: function (event, ui) {
        var terms = split(this.value);
        // remove the current input
        terms.pop();
        // add the selected item
        terms.push(ui.item.value);
        // add placeholder to get the delim-and-space at the end
        terms.push("");
        this.value = terms.join("; ");
        BrainBrowser.volumeviewer.setSelectedLabels(event.target);
        return false;
      },
    });
    $(elem).on("focus", function () {
      $(this).autocomplete("search", "");
    });
  };
  // remove parent element of event.srcElement
  this.removeParent = function (elem) {
    let regions = elem.querySelectorAll(".brainRegion");
    for (let region of regions) {
      BrainBrowser.volumeviewer.removeRoi(region.id);
    }
    elem.remove();
  };
  // handle ilae seizure classification selection
  this.selectType = function (elem) {
    const target = elem.parentElement.querySelector('[name="type-content"]');
    var val = elem.value;
    switch (parseInt(val)) {
      case 0:
        target.innerHTML = "";
        var t = document.querySelector("#semiology-focal-template");
        var clone = document.importNode(t.content, true);
        target.appendChild(clone);
        break;
      case 1:
        target.innerHTML = "";
        var t = document.querySelector("#semiology-generalized-template");
        var clone = document.importNode(t.content, true);
        target.appendChild(clone);
        break;
      case 2:
        target.innerHTML = "";
        var t = document.querySelector("#semiology-unknown-template");
        var clone = document.importNode(t.content, true);
        target.appendChild(clone);
        break;
      case 3:
        target.innerHTML = "";
        break;
      default:
        target.innerHTML = "";
        break;
    }
  };
  // restore IDs to values saved in subject
  this.restoreSubjectIDs = function () {
    for (let k of Object.keys(window.ids2Indcs)) {
      let vals =
        window.dataset.subjects[window.selectedSubjectIdx].ids[k] ?? [];
      let idString = "";
      for (let v of vals) {
        idString += v + "; ";
      }
      let elem = document.getElementById(k);
      elem.value = idString;
      elem.style.color = "black";
    }
    document.getElementById("restoreIDs").style.display = "none";
  };
  // handle ilae seizure classification sub selection
  this.selectOnset = function (elem) {
    const target = elem.parentElement.querySelector(
      '[name="symptom-container"]'
    );
    const val = elem.value;
    switch (parseInt(val)) {
      case 0:
        target.innerHTML = "";
        var t = elem.parentElement.querySelector("#motor");
        var clone = document.importNode(t.content, true);
        target.appendChild(clone);
        break;
      case 1:
        target.innerHTML = "";
        var t = elem.parentElement.querySelector("#nonmotor");
        var clone = document.importNode(t.content, true);
        target.appendChild(clone);
        break;
      default:
        target.innerHTML = "";
        break;
    }
  };
  // enable interacting with an element
  this.enableElement = function (id) {
    document.getElementById(id).classList.remove("disabled");
  };
  // disable interacting with an element
  this.disableElement = function (id) {
    document.getElementById(id).classList.add("disabled");
  };
  ///
  //  ***functions for loading/creating data***
  ///

  // development
  this.loadDevComments = function () {
    var dev_comments = storage.get("dev_comments", (error, data) => {
      if (error) {
        throw error;
      }
      for (let key of Object.keys(data)) {
        var elem = document.getElementById(key);
        elem.value = data[key];
      }
    });
  };
  // add dataset from file to the local dataset, does not overwrite
  this.importDataFromFile = function () {
    const importFilePath = dialog.showOpenDialogSync(
      BrowserWindow.getFocusedWindow(),
      {
        title: "Select Dataset File:",
        properties: ["openFile"],
      }
    );
    if (!importFilePath) {
      return;
    }

    const splits = importFilePath[0].split(".");
    const ending = splits[splits.length - 1];
    const pjson = require(path.join(__dirname, "../../../package.json"));
    const data_version = pjson["dataVersion"];

    let importFile = fs.readFileSync(importFilePath[0], "utf8");

    //parse file according to type
    if (ending === "json") {
      var dataset = JSON.parse(importFile.toString());
    } else if (ending === "csv") {
      //seperated by a semicolon as of now !
      //not supported right now
      console.log("dont");
      alert("CSV loading not supported at the moment, load tsv instead");
      return;
      var lines = importFile.split("\n");
      var dataset = {};
      dataset.subjects = [];
      dataset.version = data_version;
      var headers = lines[0].split(";");

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) {
          continue;
        }
        var sub = {};
        var currentline = lines[i].split(";");
        // start at 1 to skip intern id for now
        for (let j = 1; j < headers.length; j++) {
          sub[headers[j]] = currentline[j];
        }
        dataset.subjects.push(sub);
      }
    } else if (ending === "txt") {
      console.log(
        "Importing from tab-delimited text is unsave.. I'll allow it this time!"
      );
      importFile = importFile.replace(/\r/g, "");
      var lines = importFile.split("\n");
      var dataset = {};
      dataset.subjects = [];
      dataset.version = data_version;
      var headers = lines[0].split("\t");
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) {
          continue;
        }
        let sub = {};
        let currentline = lines[i].split("\t");
        for (let j = 0; j < headers.length; j++) {
          let keys = headers[j].split(";");
          let obj = sub;
          for (let n = 0; n < keys.length; n++) {
            if (n === keys.length - 1) {
              let vals = currentline[j].split(";");
              let nonEmptyVals = vals.filter((a) => typeof a === "string" && a);

              if (vals.length > 1) {
                obj[keys[n]] = [];
                for (let v of nonEmptyVals) {
                  obj[keys[n]].push(v);
                }
              } else if (nonEmptyVals.length == 1) {
                obj[keys[n]] = nonEmptyVals[0];
              } else {
                obj[keys[n]] = "";
              }
            } else {
              obj[keys[n]] = obj[keys[n]] || {};
              obj = obj[keys[n]];
            }
          }
          //sub[headers[j]] = currentline[j];
        }
        dataset.subjects.push(sub);
      }
    } else {
      alert("Unknown datatype.");
    }

    if (dataset.version !== data_version) {
      alert("It appears the data is in a format or version... did not load!");
    } else {
      for (let sub of dataset.subjects) {
        let subIDs = sub.ids;
        let idcs = [];
        for (let idName of Object.keys(subIDs)) {
          // idcs[id.value] = id !== "" ? window
          for (let idString of subIDs[idName]) {
            let id = parseInt(idString);
            let tmp = window.IDs[idName][id];
            idcs.push(tmp ?? (id !== "" ? null : undefined));
          }
        }

        let commonIdx;

        if (idcs.every((element) => typeof element === "undefined")) {
          commonIdx = undefined;
        } else {
          commonIdx = this.allIDsMatch(null, idcs);
        }
        if (commonIdx !== null && commonIdx >= 0) {
          let a = 1;
        }
        switch (commonIdx) {
          case -1:
            //not matching
            console.log("Error, IDs not consistent with existing Dataset");
            break;
          case undefined:
            //not matching
            console.log("no ids found for subject");
            break;
          case null:
            //doesnt exist in dataset
            window.dataset.subjects.push(sub);

            break;
          default:
            let subject = window.dataset.subjects[commonIdx];

            let addSubjectInfo = function (objDest, vals) {
              if (vals instanceof Array) {
                objDest = objDest || [];
                for (let v of vals) {
                  if (!objDest.includes(v)) {
                    objDest.push(v);
                  }
                }
              } else if (vals instanceof Object) {
                objDest = objDest || {};
                for (let k of Object.keys(vals)) {
                  objDest[k] = addSubjectInfo(objDest[k], vals[k]);
                }
              } else {
                objDest = objDest || vals;
              }
              return objDest;
            };

            subject = addSubjectInfo(subject, sub);

            //subject exist with this ID already... TODO
            console.log("Subject exists!");
            break;
        }
      }
    }
    storage.set("dataset", window.dataset, function (error) {
      if (error) {
        throw error;
      } else {
        document.getElementById("restoreIDs").style.display = "none";
        console.log("Import success!");
        return true;
      }
    });
    this.createIDLists();
  };
  // load locally stored dataset
  this.loadDataset = function () {
    var pjson = require(path.join(__dirname, "../../../package.json"));
    var data_version = pjson["dataVersion"];

    storage.get("dataset", (error, data) => {
      if (error) {
        throw error;
      }
      if (Object.keys(data).length !== 0) {
        if (data.version) {
          if (data.version != data_version) {
            console.log(
              "wrong dataset version, delete dataset.json in appdata storage under: " +
                storage.getDefaultDataPath()
            );
            // dataset conversion
          } else {
            window.dataset = data;
          }
        } else {
          console.log(
            "Could not read dataset version, delete dataset.json in appdata storage under:" +
              storage.getDefaultDataPath()
          );
          window.dataset = {};
          window.dataset.version = data_version;
        }
      } else {
        window.dataset = data;
        window.dataset.version = data_version;

        console.log("Initializing dataset...");
      }
      this.createIDLists(window.dataset);
    });
  };
  // convert all IDs from the dataset into datalists and append them to the inputs,
  // so that we can use them for autocompletion when loading a subject
  this.createIDLists = function () {
    window.selectedSubjectIdx = null;
    window.inputSubjectIdx = null;
    let IDs = {};

    var i = 0;
    var IDLists = {};
    let idsElem = document.getElementById("ids");
    let idElems = idsElem.querySelectorAll("input");
    for (let e of idElems) {
      IDs[e.name] = {};
      let list = document.querySelector("#" + e.name + "List");
      if (!list) {
        IDLists[e.name] = document.createElement("datalist");
        IDLists[e.name].id = e.name + "List";
      } else {
        list.innerHTML = "";
        IDLists[e.name] = list;
      }
    }

    if (!window.dataset.subjects) {
      window.dataset.subjects = [];
    }
    for (let p of window.dataset.subjects) {
      for (let id of Object.keys(p.ids)) {
        let elems = p.ids[id]; //.split(/;\s*/);
        for (let e of elems) {
          if (e !== "") {
            let option = document.createElement("option");
            option.value = e;
            option.name = e;
            IDs[id][e] = i;
            IDLists[id].appendChild(option);
          }
        }
      }
      i++;
    }
    window.IDs = IDs;

    //remove existing datalists
    for (let id of Object.keys(IDLists)) {
      let list = document.getElementById(IDLists[id].id);
      if (list) {
        list.remove();
      }
      let elem = document.getElementById("controls").appendChild(IDLists[id]);
      document.getElementById(id).setAttribute("list", elem.id);
    }
  };
  // handle new subject button press, ask to save and reload page
  this.newSubject = function (e) {
    var subject = this.subjectFromHTML();
    var existingSubjectString =
      window.selectedSubjectIdx === window.dataset.subjects.lendth
        ? {}
        : JSON.stringify(window.dataset.subjects[window.selectedSubjectIdx]);
    var newSubjectString = JSON.stringify(subject);
    if (existingSubjectString !== newSubjectString) {
      var r = confirm(
        "It appears you have unsaved changes. Do you want to save now?"
      );

      if (r == true) {
        this.save(subject);
      }
    }
    //get dataset to make sure it is saved first
    storage.get("dataset", function (error, data) {
      if (error) {
        throw error;
      }
      this.resetHtml();
      history.go(0);
    });
  };
  // handle next subject button press, ask to save and load next subject
  this.nextSubject = function (back = false) {
    var subject = this.subjectFromHTML();
    var existingSubjectString =
      window.selectedSubjectIdx === window.dataset.subjects.lendth
        ? {}
        : JSON.stringify(window.dataset.subjects[window.selectedSubjectIdx]);
    var newSubjectString = JSON.stringify(subject);
    if (existingSubjectString !== newSubjectString) {
      var r = confirm(
        "It appears you have unsaved changes. Do you want to save now?"
      );

      if (r == true) {
        this.save(subject);
      }
    }

    //get dataset to make sure it is saved first
    storage.get("dataset", function (error, data) {
      if (error) {
        throw error;
      }
      this.resetHtml();
      this.loadSubject(true, back);
    });
  };
  // reset html inputs
  this.resetHtml = function () {
    document.getElementById("seizureTypes").innerHTML = "";
    document.getElementById("etiologies").innerHTML = "";
    document.getElementById("modalities").innerHTML = "";
    document.getElementById("surgicalContainer").innerHTML = "";

    for (let elem of document.querySelectorAll(".toSave")) {
      elem.value = elem.defaultValue;
    }
    for (let elem of document.querySelectorAll(".toSaveMultiple")) {
      elem.value = elem.defaultValue;
    }
  };
  // write object to html
  this.populateHtml = function (container, obj) {
    let type = typeof obj;
    if (obj instanceof Array) {
      for (let child of obj) {
        if (child instanceof Object) {
          populateHtml(container, child);
        } else {
          if (!container.value.includes(child)) {
            container.value =
              container.value === ""
                ? child + ";"
                : container.value.endsWith(";")
                ? container.value + " " + child + ";"
                : container.value + "; " + child + ";";
          }
        }
      }
    } else if (obj instanceof Object) {
      for (let key of Object.keys(obj)) {
        if (key === "ROI") {
          let elems = container.querySelectorAll("[name=region]");
          if (elems.length != 1) {
            //non unique association, should not happen
            console.log("problem with data assoc");
          }
          window.BrainBrowser.volumeviewer.ROIs[elems[0].id] = obj[key];
          continue;
        }
        let elems = container.querySelectorAll("[name=" + key + "]");
        if (elems.length > 1) {
          //non unique association, should not happen
          console.log("problem with data assoc");
        }
        if (elems.length === 1) {
          let elem = elems[0];
          if (key === "etiologies") {
            for (let child of obj[key]) {
              let newElem = this.addTemplate(
                "etiology-template",
                document.getElementById("etiologies")
              );
              populateHtml(newElem, child);
            }
          } else if (key === "seizureTypes") {
            for (let child of obj[key]) {
              let newElem = this.addSeizureType();
              let typeElem = newElem.querySelector("#seizureType");
              typeElem.value = child.seizureType;
              this.selectType(typeElem);
              let onsetElem = newElem.querySelector("#onsetCharacteristic");
              if (onsetElem) {
                onsetElem.value = child.onsetCharacteristic;
                selectOnset(onsetElem);
              }
              populateHtml(newElem, child);
            }
          } else if (key == "seizures") {
            for (let child of obj[key]) {
              let newElem = this.addSeizure(
                container.querySelector("#seizures")
              );
              populateHtml(newElem, child);
            }
          } else if (key === "modalities") {
            for (let child of obj[key]) {
              let newElem = addTemplate(
                "imaging-template",
                document.getElementById("modalities")
              );
              populateHtml(newElem, child);
            }
          } else if (key === "ictal") {
            // let semiContainer = document.querySelector("#seizuretypes");
            // let semiElems = semiContainer.querySelectorAll("[name='typeID']");
            // let semiElem;
            // for (let child of obj[key]) {
            //   for (let e of semiElems) {
            //     if (e.value == child.typeID) {
            //       semiElem = e.parentElement.parentElement;
            //       break;
            //     }
            //   }
            //   let newElem = elem.querySelector("#" + semiElem.id + "_eeg");
            //   populateHtml(newElem, child);
            // }
          } else if (key === "surgical") {
            if (obj[key].plan) {
              document.getElementById("planCheckbox").checked = true;
              document.getElementById("procedureCheckbox").style.display =
                "initial";
              let planElem = this.handlePlanned();
              populateHtml(planElem, obj[key].plan);
            }
            if (obj[key].procedure) {
              //just in case surgery is enterd but no planning info
              if (!obj[key].plan) {
                obj[key].plan = {};
                document.getElementById("planCheckbox").checked = true;
                document.getElementById("procedureCheckbox").style.display =
                  "initial";
                let planElem = this.handlePlanned();
                //dont call populate here as it will be called later on
              }
              document.getElementById("procedureCheckbox").checked = true;
              document.getElementById("procedureCheckbox").style.display =
                "initial";
              let procedureElem = this.handleProcedure();
              populateHtml(procedureElem, obj[key].procedure);
            }
          } else {
            populateHtml(elem, obj[key]);
          }
        }

        // else {
        //   //elem doesnt exist, we need to create it ?
        //   if (key === "ROIs") {
        //     //abuse that the rois are saved in the same order as they appear in the html TODO
        //     for (let i = 0; i < Object.values(obj[key]).length; i++) {
        //       BrainBrowser.volumeviewer.ROIs[i] = obj[key][i];
        //     }
        //   }
        // }
      }
    } else if (container.type === "checkbox") {
      container.checked = obj;
    } else {
      container.value = obj;
    }
  };
  // load a subject from dataset
  this.loadSubject = function (nextSubject = false, back = false) {
    let currentActiveTab = undefined;
    if (nextSubject) {
      currentActiveTab =
        document.getElementsByClassName("tablinks active")[0].id;

      let increment = back ? -1 : 1;
      let n = window.dataset.subjects.length;
      ((this % n) + n) % n;
      //can go negative
      window.selectedSubjectIdx =
        (((window.selectedSubjectIdx + increment) % n) + n) % n;
      window.inputSubjectIdx = window.selectedSubjectIdx;

      let idsElem = document.getElementById("ids");
      let idElems = idsElem.querySelectorAll("input");
      window.ids2Indcs = {};
      for (let e of idElems) {
        window.ids2Indcs[e.name] = null;
      }
    } else {
      window.selectedSubjectIdx = window.inputSubjectIdx;
      document.getElementById("loadSubject").style.display = "none";
    }
    let subject = window.dataset.subjects[window.selectedSubjectIdx];

    this.populateHtml(document, subject);

    // color all id inputs black
    for (let k of Object.keys(window.ids2Indcs)) {
      document.getElementById(k).style.color = "black";
    }

    // simulate click and keyup events to initialize brainregion inputs correctly
    this.enableElement("information");
    var withRois = document.getElementsByClassName("withRoi");
    for (let e of withRois) {
      const clickEvent = new Event("click");
      e.dispatchEvent(clickEvent);
      var hypotheses = document.querySelectorAll(".brainRegion");
      for (let hyp of hypotheses) {
        BrainBrowser.volumeviewer.changeActiveRoi(hyp.id);
        const upEvent = new Event("keyup");
        upEvent.target = hyp;
        hyp.dispatchEvent(upEvent);
      }
    }
    document
      .getElementById("seizureDesc-tab")
      .dispatchEvent(new Event("click"));
    if (nextSubject) {
      document
        .getElementById(currentActiveTab)
        .dispatchEvent(new Event("click"));
    } else {
      document.getElementById("clinical-tab").dispatchEvent(new Event("click"));
    }

    const test = $(".atlas-input");
    $(".atlas-input").attr("autocomplete", "off");
    $("textarea").trigger("input");
    $(".atlas-input").attr("autocomplete", "on");

    this.enableElement("datasetInteraction");
    this.disableElement("import-export");
  };
  //checks if ids are null or equal to each other
  this.allIDsMatch = function (id, list) {
    //possible to provide custom list
    let vals = list ?? Object.values(window.ids2Indcs);
    let val = Object.is(id, undefined) ? null : id;
    for (let i of vals) {
      if (i !== null && typeof i !== "undefined") {
        if (val === null) {
          val = i;
        } else {
          if (val !== i) {
            return -1;
          }
        }
      }
    }
    return val;
  };
  // check if input IDs match existing one and if they are consistent
  this.addIDInputListeners = function () {
    let IDLists = {};
    let idsElem = document.getElementById("ids");
    let idElems = idsElem.querySelectorAll("input");
    window.ids2Indcs = {};
    for (let e of idElems) {
      IDLists[e.name] = document.createElement("datalist");
      IDLists[e.name].id = e.name + "List";
      window.ids2Indcs[e.name] = null;
    }

    inputhandler = (e) => {
      //var dataset = window.dataset;
      let elems = e.target.value.split(/;\s*/);
      let nonEmptyElems = elems.filter((a) => typeof a === "string" && a);
      let idcs = [];
      for (let elem of nonEmptyElems) {
        idcs.push(window.IDs[e.target.name][elem] ?? null);
      }
      let idx = this.allIDsMatch(null, idcs);

      // idx = idx === null ? null : window.IDs[e.target.name][idx] ?? null;

      window.ids2Indcs[e.target.name] = idx;

      //if already loaded a subject compare to that index, otherwise input
      var commonIdx = this.allIDsMatch(
        window.selectedSubjectIdx !== null ? window.selectedSubjectIdx : idx
      );
      var buttonLoad = document.getElementById("loadSubject");
      var buttonCreate = document.getElementById("createSubject");
      // three outcomes:
      // -1 -> misaligned
      // commmonIdx -> found somewhere

      let allEmpty = true;
      // found somewhere else not here
      for (let k of Object.keys(window.ids2Indcs)) {
        let elem = document.getElementById(k);
        allEmpty &= elem.value === "";
        if (window.ids2Indcs[k] !== null) {
          elem.style.color = commonIdx === -1 ? "red" : "black"; //commonIdx === window.ids2Indcs[k] ? "black" : "orange";
        } else {
          elem.style.color =
            commonIdx === window.ids2Indcs[k] ? "black" : "orange"; //"black";
        }
      }

      //load/create button display, dont display if mismatch or subject already loaded
      window.inputSubjectIdx = allEmpty ? -1 : commonIdx;
      if (window.inputSubjectIdx === -1 || window.selectedSubjectIdx !== null) {
        if (window.selectedSubjectIdx !== null) {
          document.getElementById("restoreIDs").style.display = "initial";
        }
        buttonLoad.style.display = "none";
        buttonCreate.style.display = "none";
      } else {
        document.getElementById("restoreIDs").style.display = "none";
        buttonLoad.style.display =
          window.inputSubjectIdx !== null ? "initial" : "none";
        buttonCreate.style.display =
          window.inputSubjectIdx !== null ? "none" : "initial";
      }
    };

    for (let e of idElems) {
      e.addEventListener("keyup", inputhandler);
    }
  };
  // create a new subject with the entered IDs
  this.createSubject = function (elem) {
    window.selectedSubjectIdx = window.dataset.subjects.length;
    elem.style.display = "none";
    this.enableElement("information");
    this.enableElement("datasetInteraction");
    this.disableElement("import-export");
  };
  ///
  //  ***functions for storing data***
  ///
  // parse the development comments from document to json
  this.devCommentsFromHTML = function () {
    var elements = document.getElementsByClassName("dev");
    var comments = {};
    for (let elem of elements) {
      comments[elem.name] = elem.value;
    }
    return comments;
  };
  // convert html inputs to json
  this.htmlToJson = function (elem, obj) {
    if (!obj) {
      obj = {};
    }
    let children = elem.children;

    if (elem.classList && elem.classList.contains("toSave")) {
      let name = elem.getAttribute("name");

      //create new object for element
      if (elem.id === "plan") {
        let a = 1;
      }
      if (name === "undefined") {
        throw "name undefined";
      }
      if (
        elem.tagName === "INPUT" ||
        elem.tagName === "TEXTAREA" ||
        elem.tagName === "SELECT"
      ) {
        if (elem.type === "checkbox") {
          obj[name] = elem.checked;
        } else {
          obj[name] = elem.value;
        }
      } else {
        obj[name] = {};
        for (let e of children) {
          obj[name] = htmlToJson(e, obj[name]);
        }
      }
    } else if (elem.classList && elem.classList.contains("toSaveMultiple")) {
      let name = elem.getAttribute("name");

      // create list for children in element
      if (name === "undefined") {
        throw "id undefined";
      }
      //handle ROIS
      if (name === "region") {
        obj["ROI"] = window.BrainBrowser.volumeviewer.ROIs[elem.id];
      }
      obj[name] = [];
      if (elem.tagName === "INPUT" || elem.tagName === "TEXTAREA") {
        let elems = elem.value.split(/;\s*/);
        for (let e of elems) {
          if (e !== "") {
            obj[name].push(e);
          }
        }
      } else {
        let elems = elem.children;
        for (let e of elems) {
          let newObj = htmlToJson(e);
          if (newObj !== {}) {
            obj[name].push(newObj);
          }
        }
      }
    } else {
      for (let child of children) {
        obj = htmlToJson(child, obj);
      }
    }
    return obj;
  };
  // parse all subject info with class toSave from document to json
  this.subjectFromHTML = function () {
    let subject = this.htmlToJson(document);
    return subject;
  };
  // save subject to local dataset
  this.save = function (sub) {
    // development
    var dev_comments = devCommentsFromHTML();
    storage.set("dev_comments", dev_comments, function (error) {
      if (error) {
        throw error;
      }
    });

    // only IDs are consistent with current subject
    // TOCHECK cannot happen since save is disabled if they are not consistent

    if (
      this.allIDsMatch(window.selectedSubjectIdx) === window.selectedSubjectIdx
    ) {
      var subject;
      if (typeof sub === "undefined" || sub === null) {
        subject = this.subjectFromHTML();
      } else {
        subject = sub;
      }
      if (window.selectedSubjectIdx == window.dataset.subjects.length) {
        window.dataset.subjects.push(subject);
      } else {
        window.dataset.subjects[window.selectedSubjectIdx] = subject;
      }
      for (let id of Object.keys(subject.ids)) {
        window.IDs[id][subject.ids[id]] = window.selectedSubjectIdx;
      }

      storage.set("dataset", window.dataset, function (error) {
        if (error) {
          throw error;
        } else {
          document.getElementById("restoreIDs").style.display = "none";
          console.log("saved successfully!");
          $("#save-confirm").show(1).delay(1000).hide(1);
          return true;
        }
      });
      // fs.writeFileSync(window.datasetPath, JSON.stringify(window.dataset));
    } else {
      alert("Did not save!");
      return false;
    }
  };
  //create tsv string from dataset
  // this.dataset_to_tsv = function () {
  //   tsv_string = "";

  //   return tsv_string;
  // };
  // save dataset as json file to selected location
  this.exportDataset = function () {
    //check if changes:

    var s = moment().format("DD_MM_YYYY_HH_mm_ss");
    var name = "/dataset-" + s + ".json";
    // var tsv_name = "/dataset-" + s + ".tsv";

    var dev_name = "/dev-comments-" + s + ".json";

    var expPath = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), {
      title: "Select firectory to export dataset to: ",
      properties: ["openDirectory"],
    });

    //fs.writeFileSync(path.join(expPath[0], tsv_name), dataset_to_tsv());
    if (expPath) {
      fs.writeFileSync(
        path.join(expPath[0], name),
        JSON.stringify(window.dataset)
      );

      var dev_comments = devCommentsFromHTML();
      fs.writeFileSync(
        path.join(expPath[0], dev_name),
        JSON.stringify(dev_comments)
      );
      //clear existing dataset
      storage.set("dataset", {}, function (error) {
        if (error) {
          throw error;
        } else {
          document.getElementById("restoreIDs").style.display = "none";
          console.log("exported dataset successfully, initialized new one!");
          this.loadDataset();
          return true;
        }
      });
    }
  };
};
