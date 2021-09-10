const { ResizeObserver } = require("resize-observer");

define([path.join(__dirname, "Panel")], function (Panel) {
  class Display {
    constructor(dom_element) {
      // let container = document.createElement("div");
      // var vol_id = viewer.active_volume_idx;
      // var volume = viewer.volumes[vol_id];
      // var volume_description = volume.volume_description;

      // var template_options = volume.template || {};
      let views = ["xspace", "yspace", "zspace"];
      // var views = volume.views || ["xspace", "yspace", "zspace"];
      // var template;

      this.default_panel_width = this.default_panel_height = 256;
      const ro = new ResizeObserver((entries) => {
        console.log("changed size");
        console.log(entries);
        for (let entry of entries) {
          if (entry.contentRect) {
            length = Math.min(
              entry.contentRect.height,
              entry.contentRect.width
            );
            let axisname = entry.target
              .getElementsByClassName("volume-container")[0]
              .id.split("_")[0];
            this.setPanelSize(axisname, length, length, { scale_image: true });
          }
        }
      });

      views.forEach((axis_name) => {
        let container = document.getElementById(axis_name + "_container");
        let canvas = document.createElement("canvas");
        //canvas.width = this.default_panel_width;
        //canvas.height = this.default_panel_height;
        //let rect = container.parentElement.getBoundingClientRect();
        //let length = Math.min(rect.width, rect.height);
        canvas.width = this.default_panel_width;
        canvas.height = this.default_panel_height;
        ro.observe(container.parentElement);
        canvas.classList.add("slice-display");
        canvas.id = axis_name + "_canvas";
        canvas.style.backgroundColor = "#000000";
        container.appendChild(canvas);
        this.panels[axis_name] = new Panel(axis_name, canvas);
        // viewer.createPanel(volume, vol_id, axis_name, canvas, {
        //   x: canvas.width / 2,
        //   y: canvas.height / 2,
        // });
      });

      // if (template_options.element_id && template_options.viewer_insert_class) {
      //   template = getTemplate(
      //     container,
      //     vol_id,
      //     template_options.element_id,
      //     template_options.viewer_insert_class
      //   );

      //   if (typeof template_options.complete === "function") {
      //     template_options.complete(volume, template);
      //   }

      //   Array.prototype.forEach.call(template, function (node) {
      //     if (node.nodeType === 1) {
      //       container.appendChild(node);
      //     }
      //   });
      // }

      // See if a subsequent volume has already been loaded. If so we want
      // to be sure that this container is inserted before the subsequent
      //container. This guarantees the ordering of elements.
      //

      //dom_element.appendChild(container);
    }

    panels = {};
    active_panel = null;
    volume = null;
    default_panel_width = null;
    default_panel_height = null;

    setVolume(volume) {
      this.volume = volume;
      Object.values(this.panels).forEach((panel) => {
        panel.set(volume, {
          x: panel.canvas.width / 2,
          y: panel.canvas.height / 2,
        });
      });
      this.refreshPanels();
    }

    setPanel = function (axis_name, panel) {
      if (this.panels[axis_name]) {
        this.panels[axis_name].triggerEvent("eventmodelcleanup");
      }
      this.panels[axis_name] = new Panel();
    };

    setAllPanelSize = function (width, height, options) {
      Object.values(this.panels).forEach(function (panel) {
        panel.setSize(width, height, options);
      });
    };

    setPanelSize = function (axisname, width, height, options) {
      this.panels[axisname].setSize(width, height, options);
    };

    getPanel = function (axis_name) {
      return this.panels[axis_name];
    };

    refreshPanels = function () {
      Object.values(this.panels).forEach(function (panel) {
        panel.updateSlice();
      });
    };

    setContrast = function (contrast) {
      display.forEach(function (panel) {
        panel.contrast = contrast;
      });
    };

    setBrightness = function (brightness) {
      display.forEach(function (panel) {
        panel.brightness = brightness;
      });
    };

    // forEach = function (callback) {
    //   Object.keys(panels).forEach(function (axis_name, i) {
    //     callback(panels[axis_name], axis_name, i);
    //   });
    // };
  }
  return Display;
});
