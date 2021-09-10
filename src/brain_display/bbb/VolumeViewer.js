define([
  path.join(__dirname, "Volume"),
  path.join(__dirname, "Loader"),
  path.join(__dirname, "Display"),
  path.join(__dirname, "Nifti1"),
  path.join(__dirname, "VVutils"),
], function (Volume, Loader, Display, Nifti1, VVUtils) {
  class Viewer {
    constructor(element, colorMapUrl, volumeDescriptions) {
      if (typeof element === "string") {
        this.dom_element = document.getElementById(element);
      } else {
        this.dom_element = element;
      }
      this.#keyboardControls();
      this.volume_loaders.nifti1 = Nifti1;
      this.display = new Display(this.dom_element);
      let cont = document.getElementById("xspace_container");
      let rect = cont.getBoundingClientRect();
      let length = Math.min(rect.width, rect.height);
      this.display.setAllPanelSize(length, length, { scale_image: false });

      this.loadVolumes(volumeDescriptions);
      this.default_cursor_color = "#FF0000";
      this.loadDefaultColorMapFromUrl(colorMapUrl, null).then(() => {
        this.color_map = this.default_color_map;
      });

      this.#mouseevents();

      this.containers[this.containers.length] = this.display.container;
      $("#loading").hide();
      $("#brainbrowser-wrapper").slideDown({ duration: 100 });

      Promise.all(this.volumes).then((volumes) => {
        this.volumes = volumes;
        if (this.volumes.length > 0) {
          this.setActiveVolume(this.volumes[0].description.name);

          this.initROIs();
        }
      });

      Promise.all(this.atlantes).then((atlantes) => {
        this.atlantes = atlantes;
        if (this.atlantes.length > 0) {
          this.initSelectedLabels();
          this.setActiveAtlas(this.atlantes[0].description.name);
          this.loadAtlasLabels();
        }
      });

      this.render();
    }

    dom_element = null;
    volumes = [];
    atlantes = [];
    containers = [];
    synced = false;
    volume_loaders = {};
    display = null;
    active_volume_name = null;
    active_volume_idx = null;
    active_atlas_idx = null;
    active_atlas_name = null;
    volumeNameIdxDict = {};
    atlasNameIdxDict = {};
    ROIs = {};
    atlasLabels = {};
    origLabels = ["unknown", "not clear"];
    KeyActiveROI = "";
    color_map = { cursor_color: null };
    default_color_map = null;
    insideRoi = false;
    selectedLabels = {};

    utils = VVUtils;

    setActiveVolume(name) {
      Promise.all(this.volumes).then((vols) => {
        this.volumes = vols;
        if (name in this.volumeNameIdxDict && this.active_volume_name != name) {
          this.active_volume_name = name;
          this.active_volume_idx = this.volumeNameIdxDict[name];
          vols[this.active_volume_idx].color_map =
            vols[this.active_volume_idx].color_map || this.default_color_map;
          this.display.setVolume(vols[this.active_volume_idx]);
        }
      });
    }

    setActiveAtlas(name) {
      if (name in this.atlasNameIdxDict && this.active_atlas_name != name) {
        this.active_atlas_name = name;
        this.active_atlas_idx = this.atlasNameIdxDict[name];
      }
    }

    async loadDefaultColorMapFromUrl(url, cursor_color) {
      cursor_color = cursor_color || this.default_cursor_color;
      const cmap = await Loader.loadColorMapFromURL(url, null, {
        scale: 255,
      }).catch((err) => {
        console.log(err);
      });
      this.setDefaultColorMap(cmap, cursor_color);
    }

    async loadVolume(volume_description) {
      var loader = this.volume_loaders[volume_description.type];
      var error_message;

      if (loader) {
        const data = await loader(volume_description).catch((err) => {
          console.log(err);
        });
        var volume = new Volume(volume_description, data.header, data.data);

        var views = volume_description.views || ["xspace", "yspace", "zspace"];

        views.forEach(function (axis) {
          volume.position[axis] = Math.floor(
            volume.header[axis].space_length / 2
          );
        });

        console.log(
          "loaded volume",
          volume.description.name,
          "as",
          volume.description.template.type
        );
        return volume;
      } else {
        error_message = "Unsuported Volume Data Type";
        throw new Error(error_message);
      }
    }

    async loadVolumes(volume_descriptions) {
      var num_descriptions = volume_descriptions.length;

      volume_descriptions.forEach(async (desc) => {
        if (desc.template.type === "volume") {
          this.volumes[this.volumes.length] = this.loadVolume(desc);

          this.volumeNameIdxDict[desc.name] = this.volumes.length - 1;
        } else if (desc.template.type === "atlas") {
          this.atlantes[this.atlantes.length] = this.loadVolume(desc);
          this.atlasNameIdxDict[desc.name] = this.atlantes.length - 1;
        } else {
          error_message = "Unsuported Volume Template Type";
          throw new Error(error_message);
        }
      });
    }

    loadAtlasLabels() {
      for (let atlas of this.atlantes) {
        let labelsPath = atlas.description.labels;
        let ending =
          labelsPath.substring(
            labelsPath.lastIndexOf(".") + 1,
            labelsPath.length
          ) || labelsPath;
        this.atlasLabels[atlas.description.name] = {};
        var Connect = new XMLHttpRequest();
        // Define which file to open and
        // send the request.
        Connect.open("GET", atlas.description.labels, false);
        Connect.setRequestHeader("Content-Type", "text/xml");
        Connect.send();
        // Place the response in an XML document.
        if (ending == "xml") {
          let doc = Connect.responseXML;
          // var datalist = document.getElementById("atlas-regions");
          let labels = doc.getElementsByTagName("label");
          let key;
          for (let label of labels) {
            let text = label.innerHTML;
            this.origLabels.push(text);

            let subLabels = text.split(".");
            for (let l of subLabels) {
              if (l != "*") {
                key = l.replace(/\s/g, "");
                key = key.toUpperCase();
                this.atlasLabels[atlas.description.name][key] =
                  this.atlasLabels[atlas.description.name][key] || [];
                this.atlasLabels[atlas.description.name][key].push(
                  parseInt(label.getAttribute("index")) + 1
                );
              }
            }
          }
        } else if (ending == "txt") {
          let a = 1;
        } else if (ending == "json") {
          let doc = Connect.responseText;
          this.atlasLabels[atlas.description.name] = JSON.parse(doc);
          for (let l of Object.keys(this.atlasLabels[atlas.description.name])) {
            this.origLabels.push(l);
          }
        } else {
          console.log("Unknown atlas format.");
        }
      }
    }

    addSelectedLabels(id) {
      this.selectedLabels[id] = {};
      for (let atlas of this.atlantes) {
        this.selectedLabels[id][atlas.description.name] = [];
      }
    }

    initSelectedLabels() {
      var elemsWithRoi = document.getElementsByClassName("withRoi");
      for (var j = 0; j < elemsWithRoi.length; ++j) {
        const hyp = elemsWithRoi[j].querySelectorAll(".brainRegion");
        for (let h of hyp) {
          this.addSelectedLabels(h.id);
        }
      }
    }

    setSelectedLabels(elem) {
      if (this.KeyActiveROI !== "") {
        var text = elem.value;
        var labels = text.split(";");
        var newSelectedLabels = {};
        var key;
        for (let l of labels) {
          key = l; //.replace(/\s/g, "");
          //key = key.toUpperCase();
          // if (key.includes("GYROS")) {
          //   document.getElementById("gyros").style.display = "inline-block";
          // } else {
          //   document.getElementById("gyros").style.display = "none";
          // }
          for (let atlas of this.atlantes) {
            newSelectedLabels[atlas.description.name] =
              newSelectedLabels[atlas.description.name] || [];
            if (this.atlasLabels[atlas.description.name][key]) {
              newSelectedLabels[atlas.description.name].push.apply(
                newSelectedLabels[atlas.description.name],
                this.atlasLabels[atlas.description.name][key]
              );
            }
          }
        }

        this.selectedLabelsChanged =
          JSON.stringify(newSelectedLabels) !==
          JSON.stringify(this.selectedLabels[this.KeyActiveROI]);
        if (this.selectedLabelsChanged) {
          this.selectedLabels[this.KeyActiveROI] = newSelectedLabels;
          this.redrawVolume();
        }
      }
    }

    setDefaultColorMap(color_map, cursor_color) {
      color_map.cursor_color = cursor_color;
      this.default_color_map = color_map;

      this.volumes.forEach(async (volume) => {
        var volume = await volume;
        volume.color_map = volume.color_map || this.default_color_map;
      });
    }

    setDefaultPanelSize(width, height) {
      this.display.default_panel_width = width;
      this.display.default_panel_height = height;
    }

    removeRoi(id) {
      if (this.KeyActiveROI === id) {
        this.changeActiveRoi("");
      }
      delete this.selectedLabels[id];
      delete this.ROIs[id];
    }

    addRoi(id) {
      var views = ["xspace", "yspace", "zspace"];
      this.ROIs[id] = {};
      views.forEach((axis) => {
        this.ROIs[id][axis] = {
          min: -1, //this.volumes[this.active_volume_idx].position[axis],
          max: -1, //this.volumes[this.active_volume_idx].position[axis],
        };
      });
      this.ROIs[id]["activeCorner"] = -2;
    }

    initROIs() {
      const elemsWithRoi = document.getElementsByClassName("withRoi");
      var views = ["xspace", "yspace", "zspace"];
      for (var j = 0; j < elemsWithRoi.length; ++j) {
        const hyp = elemsWithRoi[j].querySelectorAll(".brainRegion");
        for (let h of hyp) {
          this.addRoi(h.id);
        }
      }
      this.copiedROI = {};
      this.copiedROI["activeCorner"] = -2;

      views.forEach((axis) => {
        this.copiedROI[axis] = {
          min: 0,
          max: 0,
        };
      });
      this.KeyActiveROI = this.KeyActiveROI || "";

      var activeElem = document.getElementsByClassName("withRoi active");

      if (activeElem.length == 1) {
        this.KeyActiveROI = activeElem[0].id;
      }
    }

    render() {
      this.draw();
      window.requestAnimationFrame(() => {
        this.render();
      });
    }

    draw() {
      if (this.active_volume_idx !== null) {
        Object.values(this.display.panels).forEach((panel) => {
          if (panel.isUpdated()) {
            document.getElementById(panel.axis).value =
              this.volumes[this.active_volume_idx].position[panel.axis];
            if (
              panel.draw(
                this.color_map.cursor_color,
                this.display.active_panel === panel
              )
            ) {
              this.drawRoi(panel);
              this.overlayAtlas(panel);
            }
          }
        });
      }
    }

    // Draw region of intereset
    drawRoi(panel) {
      if (this.KeyActiveROI == "") {
        return;
      }
      var roi = this.ROIs[this.KeyActiveROI];
      if (roi.activeCorner === -2) {
        return;
      }
      var widthSpace = panel.slice.width_space.name;
      var heightSpace = panel.slice.height_space.name;

      if (roi[widthSpace] === {} || roi[heightSpace] === {}) {
        return;
      }

      var color;
      if (this.insideRoi) {
        color = "#FFF000";
      } else {
        color = "#888000";
      }

      var min = panel.volumeToPanel(roi[widthSpace].min, roi[heightSpace].min);
      var max = panel.volumeToPanel(roi[widthSpace].max, roi[heightSpace].max);
      var context = panel.context;

      context.save();

      context.strokeStyle = color;
      context.fillStyle = color;

      context.lineWidth = 2;
      // draw rectangle clockwise
      context.beginPath();
      context.moveTo(min.x, min.y);
      context.lineTo(max.x, min.y);
      context.lineTo(max.x, max.y);
      context.lineTo(min.x, max.y);
      context.lineTo(min.x, min.y);
      context.stroke();
      context.restore();
    }

    overlayAtlas(panel) {
      for (let atlas of this.atlantes) {
        if (
          this.KeyActiveROI !== "" &&
          this.selectedLabels[this.KeyActiveROI][atlas.description.name]
            .length !== 0
        ) {
          var axis = panel.axis;
          var volume = this.volumes[this.active_volume_idx];

          var factor = atlas.header[axis].step / volume.header[axis].step;
          var corrected_slice_num = Math.abs(
            Math.round(volume.position[axis] / factor)
          );
          var time = this.volumes[this.active_volume_idx].current_time;

          var slice = atlas.slice(axis, corrected_slice_num, time);
          var xstep = slice.width_space.step;
          var ystep = slice.height_space.step;

          var target_width = Math.abs(
            Math.floor(slice.width * xstep * panel.zoom)
          );
          var target_height = Math.abs(
            Math.floor(slice.height * ystep * panel.zoom)
          );
          var target_image = volume.image_creation_context.createImageData(
            target_width,
            target_height
          );

          //TODO cache calculations
          //recalculate image containing all selected atlas labels
          this.atlasSliceNum = corrected_slice_num;
          //get for currently selected slice from atlas

          var selectedLabels =
            this.selectedLabels[this.KeyActiveROI][atlas.description.name] ||
            [];

          // var image = atlas.getSliceImage(slice, panel.zoom, panel.contrast, panel.brightness);

          var outImage = new Uint8ClampedArray(slice.data.length * 4);

          var i, count, value, ic;
          for (i = 0, count = slice.data.length; i < count; i++) {
            value = slice.data[i];
            ic = i * 4;
            if (selectedLabels.includes(value)) {
              outImage[ic + 0] = 255;
              outImage[ic + 1] = 55;
              outImage[ic + 2] = 55;
              outImage[ic + 3] = 100;
            } else {
              outImage[ic + 0] = 0;
              outImage[ic + 1] = 0;
              outImage[ic + 2] = 0;
              outImage[ic + 3] = 0;
            }
          }

          var tmp = this.utils.nearestNeighbor(
            outImage,
            slice.width,
            slice.height,
            target_width,
            target_height,
            {}
          );
          target_image.data.set(tmp);

          //binaries slice with matching pixels = 1
          //set all pixels not at boundary to 0
          //draw pixels at boundary
          var canvasOverlay = document.createElement("canvas");
          canvasOverlay.width = panel.canvas.width;
          canvasOverlay.height = panel.canvas.height;
          var ctxOverlay = canvasOverlay.getContext("2d");

          var context = panel.context;
          context.save();

          origin = {
            x: panel.image_center.x - target_image.width / 2,
            y: panel.image_center.y - target_image.height / 2,
          };

          ctxOverlay.putImageData(target_image, origin.x, origin.y);
          context.drawImage(canvasOverlay, 0, 0);
          context.restore();
        }
      }
    }

    resetView() {
      this.resetDisplays();
      this.redrawVolume();
    }

    resetDisplays() {
      Object.values(this.display.panels).forEach((panel) => {
        panel.reset();
      });
    }

    redrawVolume() {
      Object.values(this.display.panels).forEach((panel) => {
        panel.updateSlice();
      });
    }

    updateVolumePosition2D(panel, x, y) {
      if (x !== undefined && y !== undefined) {
        var pos = panel.panelToVolume(x, y);
        // slice_x = Math.round((x - origin.x) / zoom / Math.abs(slice.width_space.step));
        // slice_y = Math.round(slice.height_space.space_length - (y - origin.y) / zoom  / Math.abs(slice.height_space.step));
        this.volumes[this.active_volume_idx].position[
          panel.slice.width_space.name
        ] = pos.x;
        this.volumes[this.active_volume_idx].position[
          panel.slice.height_space.name
        ] = pos.y;
        this.#insideRoi();

        panel.updated = true;
      }
    }

    updateVolumePosition1D(panel, delta) {
      if (delta !== undefined) {
        this.volumes[this.active_volume_idx].position[panel.axis] += delta;
        this.#insideRoi();
        panel.updated = true;
      }
    }

    changeActiveRoi(id) {
      this.KeyActiveROI = id;
      Object.values(this.display.panels).forEach((panel) => {
        panel.updated = true;
      });
    }

    deleteROI() {
      if (this.KeyActiveROI != "") {
        //TODO make available spaces generic
        this.ROIs[this.KeyActiveROI]["activeCorner"] = -2;
        ["xspace", "yspace", "zspace"].forEach((val) => {
          this.ROIs[this.KeyActiveROI][val].min = this.ROIs[this.KeyActiveROI][
            val
          ].max = this.volumes[this.active_volume_idx].position[val];
        });
        Object.values(this.display.panels).forEach((panel) => {
          panel.updated = true;
        });
      }
    }

    copyROI() {
      if (this.KeyActiveROI != "") {
        this.copiedROI["activeCorner"] =
          this.ROIs[this.KeyActiveROI]["activeCorner"];
        ["xspace", "yspace", "zspace"].forEach((val) => {
          this.copiedROI[val].min = this.ROIs[this.KeyActiveROI][val].min;
          this.copiedROI[val].max = this.ROIs[this.KeyActiveROI][val].max;
        });
      }
    }

    pasteROI() {
      if (this.KeyActiveROI != "") {
        var activeROI = this.ROIs[this.KeyActiveROI];
        if (this.copiedROI["activeCorner"] != -2) {
          activeROI["activeCorner"] = this.copiedROI["activeCorner"];
          ["xspace", "yspace", "zspace"].forEach((val) => {
            activeROI[val].min = this.copiedROI[val].min;
            activeROI[val].max = this.copiedROI[val].max;
          });
          Object.values(this.display.panels).forEach((panel) => {
            panel.updated = true;
          });
        }
      }
    }

    updateROI(panel, x, y) {
      var wspace = panel.slice.width_space.name;
      var hspace = panel.slice.height_space.name;
      var pos = panel.panelToVolume(x, y);

      var activeRoi = this.ROIs[this.KeyActiveROI];

      if (activeRoi["activeCorner"] === -2) {
        activeRoi["activeCorner"] = -1;
        activeRoi[wspace].min = activeRoi[wspace].max = pos.x;
        activeRoi[hspace].min = activeRoi[hspace].max = pos.y;
        activeRoi[panel.axis].min = activeRoi[panel.axis].max =
          panel.volume.position[panel.axis];
      }

      activeRoi["activeCorner"] = 0;
      // corners numbered row-wise starting at top left from 0 to 3, find val through bitwise or:
      if (pos.x > 0.5 * (activeRoi[wspace].min + activeRoi[wspace].max)) {
        activeRoi["activeCorner"] = 1;
      }

      if (pos.y > 0.5 * (activeRoi[hspace].min + activeRoi[hspace].max)) {
        activeRoi["activeCorner"] = 2 | activeRoi["activeCorner"];
      }

      // update vals of correct corner
      switch (activeRoi["activeCorner"]) {
        case 0:
          activeRoi[wspace].min = pos.x;
          activeRoi[hspace].min = pos.y;
          break;
        case 1:
          activeRoi[wspace].max = pos.x;
          activeRoi[hspace].min = pos.y;
          break;
        case 2:
          activeRoi[wspace].min = pos.x;
          activeRoi[hspace].max = pos.y;
          break;
        case 3:
          activeRoi[wspace].max = pos.x;
          activeRoi[hspace].max = pos.y;
          break;
      }
      this.#insideRoi();
    }

    #insideRoi() {
      if (this.KeyActiveROI != "") {
        this.insideRoi = ["xspace", "yspace", "zspace"].every((val) => {
          return (
            this.volumes[this.active_volume_idx].position[val] >=
              this.ROIs[this.KeyActiveROI][val].min &&
            this.volumes[this.active_volume_idx].position[val] <=
              this.ROIs[this.KeyActiveROI][val].max
          );
        });
      }
    }

    // Set up global keyboard interactions.
    #keyboardControls() {
      document.addEventListener(
        "keydown",
        (event) => {
          if (!this.display.active_panel) return;
          var panel = this.display.active_panel;
          var volume = panel.volume;
          var axis_name = panel.axis;

          var key = event.which;
          var space_name, time;

          var keys = {
            // CTRL
            17: function () {
              if (panel.anchor) {
                return;
              }

              if (panel.mouse.left || panel.mouse.middle || panel.mouse.right) {
                panel.anchor = {
                  x: panel.mouse.x,
                  y: panel.mouse.y,
                };
              }
            },
            // Left
            37: function () {
              space_name = panel.slice.width_space.name;
              if (volume.position[space_name] > 0) {
                volume.position[space_name]--;
              }
            },
            // Up
            38: function () {
              space_name = panel.slice.height_space.name;
              if (
                volume.position[space_name] <
                panel.slice.height_space.space_length
              ) {
                volume.position[space_name]++;
              }
            },
            // Right
            39: function () {
              space_name = panel.slice.width_space.name;
              if (
                volume.position[space_name] <
                panel.slice.width_space.space_length
              ) {
                volume.position[space_name]++;
              }
            },
            // Down
            40: function () {
              space_name = panel.slice.height_space.name;
              if (volume.position[space_name] > 0) {
                volume.position[space_name]--;
              }
            },
          };

          if (typeof keys[key] === "function") {
            event.preventDefault();
            keys[key]();

            panel.updated = true;
            Object.values(this.display.panels).forEach(function (other_panel) {
              if (panel !== other_panel) {
                other_panel.updateSlice();
              }
            });

            // if (viewer.synced) {
            //   viewer.syncPosition(panel, volume, axis_name);
            // }

            return false;
          }
        },
        false
      );

      document.addEventListener(
        "keyup",
        (e) => {
          var key = e.which;

          var keys = {
            // CTRL key
            17: function () {
              //            Object.values(this.display.panels).forEach(function (panel) {
              //              panel.anchor = null;
              //            });
            },
          };

          if (typeof keys[key] === "function") {
            e.preventDefault();
            keys[key]();

            return false;
          }
        },
        false
      );
    }

    #mouseevents() {
      var current_target = null;
      var views = ["xspace", "yspace", "zspace"];
      views.forEach((axis_name) => {
        var panel = this.display.getPanel(axis_name);
        var canvas = panel.canvas;
        var last_touch_distance = null;

        var startDrag = (pointer, shift_key, ctrl_key) => {
          // if (ctrl_key) {
          //   Object.values(this.display.panels).forEach(function (panel) {
          //     panel.anchor = null;
          //   });

          //   panel.anchor = {
          //     x: pointer.x,
          //     y: pointer.y,
          //   };
          // }

          if (!shift_key) {
            if (pointer.left) {
              //only update position whith left click
              this.updateVolumePosition2D(panel, pointer.x, pointer.y);
              //panel.followPointer(pointer);
              Object.values(this.display.panels).forEach(function (
                other_panel
              ) {
                if (panel !== other_panel) {
                  other_panel.updateSlice();
                }
              });

              // if (viewer.synced) {
              //   viewer.syncPosition(panel, volume, axis_name);
              // }
            } else if (pointer.right) {
              // update roi with right click
              if (this.KeyActiveROI != "") {
                this.updateROI(panel, pointer.x, pointer.y);
              }
              // panel.roi.min = { x: pointer.x, y: pointer.y };
              // panel.roi.max = { x: pointer.x, y: pointer.y };
            }
          }
          panel.updated = true;
        };

        var drag = (pointer, shift_key) => {
          var drag_delta;

          if (shift_key) {
            if (pointer.left) {
              //zoom
              drag_delta = panel.getDelta(pointer);
              zoom(drag_delta);
            } else if (pointer.right) {
              panel.followPointer(pointer);
            }
          } else if (pointer.left) {
            this.updateVolumePosition2D(panel, pointer.x, pointer.y);
            Object.values(this.display.panels).forEach(function (other_panel) {
              if (panel !== other_panel) {
                other_panel.updateSlice();
              }
            });
          } else if (pointer.right) {
            if (this.KeyActiveROI != "") {
              this.updateROI(panel, pointer.x, pointer.y);
            }
            Object.values(this.display.panels).forEach(function (other_panel) {
              if (panel !== other_panel) {
                other_panel.updateSlice();
              }
            });
          }

          panel.updated = true;
        };

        var mouseDrag = (event) => {
          if (event.target === current_target) {
            event.preventDefault();
            drag(panel.mouse, event.shiftKey);
          }
        };

        var touchDrag = (event) => {
          if (event.target === current_target) {
            event.preventDefault();
            drag(panel.touches[0], panel.touches.length === views.length);
          }
        };

        var mouseDragEnd = () => {
          document.removeEventListener("mousemove", mouseDrag, false);
          document.removeEventListener("mouseup", mouseDragEnd, false);

          if (
            this.KeyActiveROI != "" &&
            this.ROIs[this.KeyActiveROI]["activeCorner"] != -2
          ) {
            this.ROIs[this.KeyActiveROI]["activeCorner"] = -1;
          }
          Object.values(this.display.panels).forEach(function (panel) {
            panel.anchor = null;
          });

          current_target = null;
        };

        var touchDragEnd = () => {
          document.removeEventListener("touchmove", touchDrag, false);
          document.removeEventListener("touchend", touchDragEnd, false);
          if (this.KeyActiveROI != "") {
            this.ROIs[this.KeyActiveROI]["activeCorner"] = -1;
          }
          Object.values(this.display.panels).forEach(function (panel) {
            panel.anchor = null;
          });
          current_target = null;
        };

        let touchZoom = (event) => {
          var dx = panel.touches[0].x - panel.touches[1].x;
          var dy = panel.touches[0].y - panel.touches[1].y;

          var distance = Math.sqrt(dx * dx + dy * dy);
          var delta;

          event.preventDefault();

          if (last_touch_distance !== null) {
            delta = distance - last_touch_distance;

            zoom(delta * 0.2);
          }

          last_touch_distance = distance;
        };

        let touchZoomEnd = () => {
          document.removeEventListener("touchmove", touchZoom, false);
          document.removeEventListener("touchend", touchZoomEnd, false);

          last_touch_distance = null;
        };

        canvas.addEventListener(
          "mousedown",
          (event) => {
            event.preventDefault();

            current_target = event.target;

            if (this.display.active_panel) {
              this.display.active_panel.updated = true;
            }
            this.display.active_panel = panel;

            document.addEventListener("mousemove", mouseDrag, false);
            document.addEventListener("mouseup", mouseDragEnd, false);

            startDrag(panel.mouse, event.shiftKey, event.ctrlKey);
          },
          false
        );

        canvas.addEventListener(
          "touchstart",
          (event) => {
            event.preventDefault();

            current_target = event.target;

            if (this.display.active_panel) {
              this.display.active_panel.updated = true;
            }
            this.display.active_panel = panel;

            if (panel.touches.length === 2) {
              document.removeEventListener("touchmove", touchDrag, false);
              document.removeEventListener("touchend", touchDragEnd, false);
              document.addEventListener("touchmove", touchZoom, false);
              document.addEventListener("touchend", touchZoomEnd, false);
            } else {
              document.removeEventListener("touchmove", touchZoom, false);
              document.removeEventListener("touchend", touchZoomEnd, false);
              document.addEventListener("touchmove", touchDrag, false);
              document.addEventListener("touchend", touchDragEnd, false);

              startDrag(panel.touches[0], panel.touches.length === 3, true);
            }
          },
          false
        );

        let wheelHandler = (event) => {
          event.preventDefault();
          if (panel) {
            this.updateVolumePosition1D(panel, Math.sign(event.wheelDelta));
          }
          panel.updateSlice();
          //zoom(Math.max(-1, Math.min(1, event.wheelDelta || -event.detail)));
        };

        let zoom = (delta) => {
          var cursor = panel.getCursorPosition();
          var dx = cursor.x - panel.canvas.width / 2;
          var dy = cursor.y - panel.canvas.height / 2;

          // if (delta > 0) {
          //   panel.translateImage(-dx * 0.3, -dy * 0.3);
          // } else {
          // }
          panel.zoom *= -delta.dy < 0 ? 1 / 1.02 : 1.02;
          panel.zoom = Math.max(panel.zoom, 0.25);

          // panel.updateVolumePosition();
          panel.updateSlice();
        };

        canvas.addEventListener("mousewheel", wheelHandler, false);
        canvas.addEventListener("DOMMouseScroll", wheelHandler, false); // Dammit Firefox
      });
    }
  }
  return Viewer;
});
