define([path.join(__dirname, "BButils")], function (utils) {
  class Panel {
    constructor(axis, canvas) {
      this.axis = axis;
      this.canvas = canvas;
      if (this.canvas && utils.isFunction(this.canvas.getContext)) {
        this.context = this.canvas.getContext("2d");
        this.mouse = this.#captureMouse();
        this.touches = this.#captureTouch();
      }
    }

    // pVolume, pAxis, pCanvas, pImage_center
    volume = null;
    axis = null;
    canvas = null;
    image_center = null;
    zoom = 1;
    default_zoom = 1;
    contrast = 1;
    brightness = 0;
    updated = false;
    slice = null;

    set(pVolume, pImage_center) {
      this.volume = pVolume;
      this.image_center = pImage_center;

      if (this.volume) {
        this.#setSlice(this.volume.slice(this.axis));
        this.default_zoom = this.volume.getPreferredZoom(
          this.canvas.width,
          this.canvas.height
        );
        this.zoom = this.default_zoom;
      }
    }

    setSize(width, height, options) {
      options = options || {};
      width = width > 0 ? width : 0;
      height = height > 0 ? height : 0;

      var scale_image = options.scale_image;
      var old_width, old_height, ratio;

      if (scale_image) {
        old_width = this.canvas.width;
        old_height = this.canvas.width;
        ratio =
          old_width == 0 ? 1 : Math.min(width / old_width, height / old_height);
      }

      this.canvas.width = width;
      this.canvas.height = height;

      if (scale_image) {
        this.zoom = this.zoom * ratio;
        this.default_zoom = this.default_zoom * ratio;

        if (this.volume) {
          this.image_center.x = width / 2;
          this.image_center.y = height / 2;
          //this.updateVolumePosition();
          this.updateSlice();
        }
      }

      this.updated = true;
    }

    getDelta(pointer) {
      var dx = pointer.x - this.#old_pointer_position.x;
      var dy = pointer.y - this.#old_pointer_position.y;
      return {
        dx: dx,
        dy: dy,
      };
    }

    followPointer(pointer) {
      let delta = this.getDelta(pointer);

      this.translateImage(delta.dx, delta.dy);

      this.#old_pointer_position.x = pointer.x;
      this.#old_pointer_position.y = pointer.y;
    }

    translateImage(dx, dy) {
      this.image_center.x += dx;
      this.image_center.y += dy;

      this.updated = true;
    }

    reset() {
      this.zoom = this.default_zoom;
      this.image_center.x = this.canvas.width / 2;
      this.image_center.y = this.canvas.height / 2;
      this.updated = true;
    }

    getCursorPosition() {
      var volume = this.volume;
      var slice = this.slice;

      // return {
      //   x: volume.position[slice.width_space.name] * Math.abs(slice.width_space.step) * this.zoom + origin.x,
      //   y: (slice.height_space.space_length - volume.position[slice.height_space.name] - 1) * Math.abs(slice.height_space.step) * this.zoom  + origin.y
      // };
      return this.volumeToPanel(
        volume.position[slice.width_space.name],
        volume.position[slice.height_space.name]
      );
    }

    panelToVolume(x, y) {
      var origin = this.#getDrawingOrigin();
      var zoom = this.zoom;
      var slice = this.slice;
      var pos = {};

      pos.x = Math.round(
        (x - origin.x) / zoom / Math.abs(slice.width_space.step)
      );
      pos.y = Math.round(
        slice.height_space.space_length -
          (y - origin.y) / zoom / Math.abs(slice.height_space.step)
      );
      pos.x =
        slice.width_space.step > 0
          ? pos.x
          : slice.width_space.space_length - pos.x;
      pos.y =
        slice.height_space.step > 0
          ? pos.y
          : slice.height_space.space_length - pos.y;

      return pos;
    }

    volumeToPanel(x, y) {
      var slice = this.slice;
      var origin = this.#getDrawingOrigin();
      var pos = {};

      x = slice.width_space.step > 0 ? x : slice.width_space.space_length - x;
      y = slice.height_space.step > 0 ? y : slice.height_space.space_length - y;

      pos.x = x * Math.abs(slice.width_space.step) * this.zoom + origin.x;
      pos.y =
        (slice.height_space.space_length - y - 1) *
          Math.abs(slice.height_space.step) *
          this.zoom +
        origin.y;
      return pos;
    }

    updateSlice(callback) {
      clearTimeout(this.#update_timeout);
      if (utils.isFunction(callback)) {
        this.#update_callbacks.push(callback);
      }

      this.#update_timeout = setTimeout(() => {
        var slice = this.volume.slice(this.axis);

        this.#setSlice(slice);

        this.updated = true;

        this.#update_callbacks.forEach(function (callback) {
          callback(slice);
        });
        this.#update_callbacks.length = 0;
      }, 0);
    }

    isUpdated() {
      var cursor = this.getCursorPosition();

      if (
        this.#old_cursor_position.x !== cursor.x ||
        this.#old_cursor_position.y !== cursor.y
      ) {
        this.#old_cursor_position.x = cursor.x;
        this.#old_cursor_position.y = cursor.y;
        this.updated = true;
      }

      if (this.#old_zoom_level !== this.zoom) {
        this.#old_zoom_level = this.zoom;
        this.updated = true;
      }
      return this.updated;
    }

    draw(cursor_color, active) {
      if (this.touches[0]) {
        this.#old_pointer_position.x = this.touches[0].x;
        this.#old_pointer_position.y = this.touches[0].y;
      } else {
        this.#old_pointer_position.x = this.mouse.x;
        this.#old_pointer_position.y = this.mouse.y;
      }

      if (!this.updated) {
        return false;
      }

      var canvas = this.canvas;
      var context = this.context;
      var frame_width = 4;
      var half_frame_width = frame_width / 2;

      context.globalAlpha = 255;
      context.clearRect(0, 0, canvas.width, canvas.height);

      this.#drawSlice();

      this.#drawCursor(cursor_color);

      this.#drawOrientation(cursor_color);

      if (active) {
        context.save();
        context.strokeStyle = "#EC2121";
        context.lineWidth = frame_width;
        context.strokeRect(
          half_frame_width,
          half_frame_width,
          canvas.width - frame_width,
          canvas.height - frame_width
        );
        context.restore();
      }

      this.updated = false;
      return true;
    }

    #captureMouse() {
      var mouse = { x: 0, y: 0, left: false, middle: false, right: false };
      var element = this.canvas;

      document.addEventListener(
        "mousemove",
        function (event) {
          var offset = utils.getOffset(element);
          var x, y;

          if (event.pageX !== undefined) {
            x = event.pageX;
            y = event.pageY;
          } else {
            x = event.clientX + window.pageXOffset;
            y = event.clientY + window.pageYOffset;
          }

          mouse.x = x - offset.left;
          mouse.y = y - offset.top;
        },
        false
      );

      element.addEventListener(
        "mousedown",
        function (event) {
          event.preventDefault();

          if (event.button === 0) {
            mouse.left = true;
          }
          if (event.button === 1) {
            mouse.middle = true;
          }
          if (event.button === 2) {
            mouse.right = true;
          }
        },
        false
      );

      element.addEventListener(
        "mouseup",
        function (event) {
          event.preventDefault();

          if (event.button === 0) {
            mouse.left = false;
          }
          if (event.button === 1) {
            mouse.middle = false;
          }
          if (event.button === 2) {
            mouse.right = false;
          }
        },
        false
      );

      element.addEventListener(
        "mouseleave",
        function (event) {
          event.preventDefault();

          mouse.left = mouse.middle = mouse.right = false;
        },
        false
      );

      element.addEventListener(
        "contextmenu",
        function (event) {
          event.preventDefault();
        },
        false
      );

      return mouse;
    }

    #captureTouch() {
      var touches = [];
      var element = this.canvas;
      function updateTouches(event) {
        var offset = utils.getOffset(element);
        var x, y;
        var i, count;
        var touch;

        touches.length = count = event.touches.length;

        for (i = 0; i < count; i++) {
          touch = event.touches[i];

          if (touch.pageX !== undefined) {
            x = touch.pageX;
            y = touch.pageY;
          } else {
            x = touch.clientX + window.pageXOffset;
            y = touch.clientY + window.pageYOffset;
          }

          touches[i] = touches[i] || {};

          touches[i].x = x - offset.left;
          touches[i].y = y - offset.top;
        }
      }

      element.addEventListener("touchstart", updateTouches, false);
      element.addEventListener("touchmove", updateTouches, false);
      element.addEventListener("touchend", updateTouches, false);

      return touches;
    }

    // Set the volume slice to be rendered on this panel.
    #setSlice(slice) {
      this.slice = slice;
      this.slice_image = this.volume.getSliceImage(
        this.slice,
        this.zoom,
        this.contrast,
        this.brightness
      );
    }

    // Draw the cursor at its current position on the canvas.
    #drawCursor = function (color) {
      var context = this.context;
      var cursor = this.getCursorPosition();
      // console.log(cursor);
      var zoom = this.zoom;
      var length = 8 * (zoom / this.default_zoom);
      var x, y, space;
      var distance;
      var dx, dy;
      color = color || "#FF0000";

      context.save();

      context.strokeStyle = color;
      context.fillStyle = color;

      space = 1;
      x = cursor.x;
      y = cursor.y;

      context.lineWidth = space * 2;
      context.beginPath();
      context.moveTo(x, y - length);
      context.lineTo(x, y - space);
      context.moveTo(x, y + space);
      context.lineTo(x, y + length);
      context.moveTo(x - length, y);
      context.lineTo(x - space, y);
      context.moveTo(x + space, y);
      context.lineTo(x + length, y);
      context.stroke();

      if (this.anchor) {
        dx = (this.anchor.x - cursor.x) / this.zoom;
        dy = (this.anchor.y - cursor.y) / this.zoom;
        distance = Math.sqrt(dx * dx + dy * dy);

        context.font = "bold 12px arial";

        if (this.canvas.width - cursor.x < 50) {
          context.textAlign = "right";
          x = cursor.x - length;
        } else {
          context.textAlign = "left";
          x = cursor.x + length;
        }

        if (cursor.y < 30) {
          context.textBaseline = "top";
          y = cursor.y + length;
        } else {
          context.textBaseline = "bottom";
          y = cursor.y - length;
        }

        context.fillText(distance.toFixed(2), x, y);

        context.lineWidth = 1;
        context.beginPath();
        context.arc(this.anchor.x, this.anchor.y, 2 * space, 0, 2 * Math.PI);
        context.fill();
        context.moveTo(this.anchor.x, this.anchor.y);
        context.lineTo(cursor.x, cursor.y);
        context.stroke();
      }

      context.restore();
    };

    #drawOrientation = function (color) {
      var letters = {
        xspace: this.slice.width_space.step < 0 ? ["R", "L"] : ["L", "R"],
        yspace: ["P", "A"],
        zspace: ["I", "S"],
      };
      var yLetters = letters[this.slice.height_space.name];
      var xLetters = letters[this.slice.width_space.name];

      var context = this.context;
      context.save();
      context.fillStyle = color;
      context.font = "bold 10px Arial";

      context.fillText(xLetters[0], 10, this.canvas.height / 2);
      context.fillText(
        xLetters[1],
        this.canvas.width - 10,
        this.canvas.height / 2
      );
      context.fillText(
        yLetters[0],
        this.canvas.width / 2,
        this.canvas.height - 10
      );
      context.fillText(yLetters[1], this.canvas.width / 2, 10);
      context.restore();
    };

    // Draw the current slice to the canvas.
    #drawSlice = function () {
      var image = this.slice_image;
      var origin;

      if (image) {
        origin = {
          x: this.image_center.x - this.slice_image.width / 2,
          y: this.image_center.y - this.slice_image.height / 2,
        };
        this.context.putImageData(image, origin.x, origin.y);
      }
    };

    // Get the origin at which slices should be drawn.
    #getDrawingOrigin = function () {
      var slice = this.slice;
      return {
        x:
          this.image_center.x -
          Math.abs(
            slice.width_space.step * slice.width_space.space_length * this.zoom
          ) /
            2,
        y:
          this.image_center.y -
          Math.abs(
            slice.height_space.step *
              slice.height_space.space_length *
              this.zoom
          ) /
            2,
      };
    };

    #old_zoom_level = 0;

    // Where the cursor used to be.
    #old_cursor_position = {
      x: 0,
      y: 0,
    };

    // Where the mouse or touch used to be.
    #old_pointer_position = {
      x: 0,
      y: 0,
    };

    #update_timeout = null;

    // Because slice updates can be interrupted, keep
    // callbacks in an array to be executed at the end.
    #update_callbacks = [];
  }
  return Panel;
});
