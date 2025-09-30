(function () {
  const globe = {
    // main globe object

    // How much the globe is rotated.
    offset_x: 0,
    // Where the globe should be rotated to.
    target_offset: undefined,

    rotating: false,

    rotating_counter: 0,

    diameter: 1000,

    // The quake highlighted on the globe and in the list.
    highlighted_quake: undefined,

    // The quake selected by the user.
    selected_quake: undefined,

    // Keep track of whether the page was just loaded.
    first_load: true,

    //colors
    land: "#516e4d",
    ocean: "#23466d",
    light_mode_land: "#516e4d",
    light_mode_ocean: "#23466d",
    dark_mode_land: "#375732", //"#516e4d",
    dark_mode_ocean: "#102d4d",

    // The list of earthquakes to display.
    quakes: [],

    latestQuake() {
      const index = this.quakes.length - 1;
      return this.quakes[index];
    },

    rotate(x_delta) {
      this.offset_x = this.offset_x + x_delta;
    },

    rotateToQuake(quake) {
      // Smooth rotation to an earthquake.
      const lon = this.highlighted_quake.data.properties.lon;

      this.rotating = false;
      this.target_offset = (-lon * Math.PI) / 180;
      this.rotating_counter = 0;
    },

    rotateToLatest() {
      this.rotateToQuake(this.latestQuake());
    },

    jumpToLatest() {
      // Snap to the latest quake without rotating.
      this.highlighted_quake = this.latestQuake();
      const lon = this.highlighted_quake.data.properties.lon;
      this.offset_x = (-lon * Math.PI) / 180;
    },

    wrap() {
      // wrap around if out of bounds.
      if (this.offset_x > Math.PI) {
        this.offset_x = this.offset_x - 2 * Math.PI;
      }
      if (this.offset_x < -Math.PI) {
        this.offset_x = this.offset_x + 2 * Math.PI;
      }
    },
  };

  getTheme = () => {
    // Return what the current theme should be, respecting user preference.
    const pref = window.localStorage.getItem("themePreference");

    if (pref !== null) {
      if (pref === "dark") {
        return "dark";
      } else if (pref === "light") {
        return "light";
      }
    }

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    } else {
      return "light";
    }
  };

  setTheme = function (theme) {
    // Change DOM elements to match either the light or dark theme.
    const sunIcon = this.document.getElementById("sun-icon");
    const moonIcon = this.document.getElementById("moon-icon");
    if (theme === "dark") {
      this.document.body.setAttribute("class", "dark-theme");
      moonIcon.setAttribute("style", "display:none;");
      sunIcon.setAttribute("style", "");
    } else if (theme === "light") {
      this.document.body.setAttribute("class", "light-theme");
      sunIcon.setAttribute("style", "display:none;");
      moonIcon.setAttribute("style", "");
    } else {
      console.error("Theme must be 'light' or 'dark'");
    }
  };

  window.addEventListener(
    "load",
    function () {
      const disclaimerEvent = new Event(
        "disclaimer",
        (options = { bubbles: true })
      );

      const disclaimer_shown = window.localStorage.getItem("disclaimerShown");
      const modal = document.getElementById("disclaimer");
      const modalButton = document.getElementById("disclaimer-button");

      if (modal !== null) {
        modal.addEventListener("disclaimer", () => {});

        if (disclaimer_shown !== "true") {
          modal.showModal();
        } else {
          modal.dispatchEvent(disclaimerEvent);
        }

        modalButton.addEventListener(
          "click",
          () => {
            modal.close();
            this.window.localStorage.setItem("disclaimerShown", "true");
            modal.dispatchEvent(disclaimerEvent);
          },
          (options = { once: true })
        );
      }
    },
    (options = { once: true })
  );

  window.addEventListener(
    "load",
    function () {
      // Set the theme on first load. Enable theme button toggling.
      const theme = getTheme();
      const themeButton = document.getElementById("theme-button");

      if (theme === "dark") {
        setTheme("dark");
      } else if (theme === "light") {
        setTheme("light");
      }

      const toggleTheme = () => {
        const prev_theme = getTheme();
        // Change theme when theme button clicked. Save preference.
        if (prev_theme === "dark") {
          window.localStorage.setItem("themePreference", "light");
          setTheme("light");
        } else if (prev_theme === "light") {
          window.localStorage.setItem("themePreference", "dark");
          setTheme("dark");
        }
      };

      themeButton.onclick = toggleTheme;

      themeButton.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleTheme();
        }
      };
    },
    (options = { once: true })
  );

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => {
      // Match system theme if no preference set.
      if (window.localStorage.getItem("themePreference") === null) {
        if (event.matches) {
          setTheme("dark");
        } else {
          setTheme("light");
        }
      }
    });

  function loadCanvas(evt) {
    window.removeEventListener(evt.type, loadCanvas, false);
    // Set up canvas. Connect to websocket. Enable mouse tracking.

    const canvas = document.getElementById("globe");
    const ctx = canvas.getContext("2d");
    const ws = new WebSocket("wss://geoticker.org/ws");

    let mouse_x_delta = 0;
    let prev_mouse_pos = [0, 0];
    let mouse_pos = [0, 0];
    let feed = this.document.getElementById("feed");
    let features;

    // Track if the mouse is clicked in the canvas

    let mouseIsDown = false;
    canvas.addEventListener("mousedown", function () {
      mouseIsDown = true;
    });
    window.addEventListener("mouseup", function () {
      mouseIsDown = false;
    });

    // Prepare land data

    features = DATA.features.map((feature) => {
      let points = feature.geometry.coordinates[0];
      return points;
    });

    features = features.map((feature) => degreesToRadians(feature));

    // Make the canvas a little bigger than the globe so that earthquake markers are not cut off when on the equator.
    canvas.width = globe.diameter * 1.1;
    canvas.height = globe.diameter * 1.1;
    // center the origin

    ctx.translate(canvas.width / 2, canvas.height / 2);

    function draw() {
      ctx.clearRect(-canvas.width/2, -canvas.width/2, canvas.width, canvas.width)
      if (!globe.first_load) {
        drawGlobe(ctx, features, globe.offset_x, globe.diameter);
        drawQuakes(
          ctx,
          globe.quakes,
          globe.offset_x,
          globe.diameter,
          //"#78e7fb"
          //"#3188df"
          //"#3f8cd9"
          "#4585c6"
        );

        if (globe.highlighted_quake !== undefined) {
          drawQuakes(
            ctx,
            [globe.highlighted_quake],
            globe.offset_x,
            globe.diameter,
            "red"
          );
        }
      }

      if (mouseIsDown) {
        globe.rotating = false;
        globe.rotating_counter = 0;
        globe.rotate(mouse_x_delta);
      }
      if (globe.rotating) {
        globe.rotate(Math.PI / 2000);
      }

      if (globe.target_offset !== undefined) {
        if (
          globe.target_offset > globe.offset_x + Math.PI / 99 ||
          globe.target_offset < globe.offset_x - Math.PI / 99
        ) {
          if (clockwise(globe.offset_x, globe.target_offset)) {
            globe.offset_x = globe.offset_x + Math.PI / 100;
          } else {
            globe.offset_x = globe.offset_x - Math.PI / 100;
          }
        } else {
          globe.target_offset = undefined;
        }
      }

      globe.wrap();
      mouse_x_delta = 0;

      // Re-enable rotation after 300 renders.
      globe.rotating_counter += 1;

      if (globe.rotating_counter > 300) {
        globe.rotating = true;
        globe.rotating_counter = 0;
      }
      window.requestAnimationFrame(draw)
    }

    ws.addEventListener("message", (event) => {
      let quake;
      const message = JSON.parse(event.data);

      if (message.cache_sent === "true") {
        if (globe.quakes.length > 0) {
          const latest_quake = document.getElementById(globe.quakes.length - 1);
          globe.jumpToLatest();
          latest_quake.className = "highlight";
        }
        globe.first_load = false;
      } else {
        quake = filterQuake(message);

        if (quake !== null) {
          globe.quakes.push(quake);
          updateFeed(feed, globe);

          // showcase latest quake if user hasn't selected a quake
          if (
            globe.quakes.length > 0 &&
            !globe.first_load &&
            globe.selected_quake === undefined
          ) {
            const highlighted_quake = document.getElementById(
              globe.quakes.length - 1
            );

            highlighted_quake.className = "highlight";

            globe.highlighted_quake = quake;
            globe.rotateToLatest();
          }
        }
      }
    });

    this.window.onmousemove = (event) => {
      // Track mouse drags.
      let rect = canvas.getBoundingClientRect();
      prev_mouse_pos = mouse_pos;
      mouse_pos = getMousePos(rect, event, globe.diameter);
      mouse_x_delta = mouse_pos[0] - prev_mouse_pos[0];
      mouse_x_delta = mouse_x_delta / (rect.width / 2);
    };
    window.requestAnimationFrame(draw);
  }

  window.addEventListener("disclaimer", loadCanvas, false);

  filterQuake = function (quake) {
    // Filter by earthquake data type and age.
    let now = new Date();
    const hour = 3600000;
    const quake_time = new Date(Date.parse(quake.data.properties.time));

    // Only keep "create" actions.
    if (quake.action !== "create") {
      return null;
    }

    // Only keep quakes from the past hour.
    if (now - quake_time > hour) {
      return null;
    }

    return quake;
  };

  updateFeed = function (feed, globe) {
    // Populate text list of earthquakes.
    feed.innerHTML = "";

    globe.quakes.map((quake, index, self) => {
      let quake_item = document.createElement("p");
      let quake_region = quake["data"]["properties"]["flynn_region"];
      let quake_magnitude = quake.data.properties.mag;
      let quake_time = new Date(Date.parse(quake.data.properties.time));
      const time_options = {
        //month: "long",
        //day: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
      };

      let quake_string = `${quake_region} | Mag. ${quake_magnitude} | ${quake_time.toLocaleTimeString(undefined, time_options)}`;

      quake_item.textContent = quake_string;
      quake_item.id = index;
      quake_item.tabIndex = 0;
      quake_item.setAttribute("role", "button");
      quake_item.setAttribute("aria-label", `Select earthquake: ${quake_string}`);

      if (quake === globe.selected_quake) {
        quake_item.className = "highlight";
      }

      feed.insertAdjacentElement("afterbegin", quake_item);

      const selectQuake = () => {
        // unselect previous highlighted quake
        const prev_quake = document.getElementsByClassName("highlight")[0];
        if (prev_quake !== undefined) {
          prev_quake.removeAttribute("class");
          globe.selected_quake = undefined;
          globe.highlighted_quake = undefined;

          // Don't reselect if an selected quake is clicked
          if (prev_quake.id === index.toString()) {
            return;
          }
        }
        // select quake
        quake_item.className = "highlight";
        globe.highlighted_quake = globe.quakes[quake_item.id];
        globe.selected_quake = globe.quakes[quake_item.id];
        globe.rotateToQuake(quake);
      };

      quake_item.onclick = selectQuake;

      quake_item.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectQuake();
        }
      };
    });
  };
  // TODO: limit the earthquakes to some arbitrary number. 10?

  function getMousePos(rect, evt) {
    return [
      evt.clientX - rect.left - rect.width / 2,
      evt.clientY - rect.top - rect.height / 2,
    ];
  }

  drawQuakes = function (ctx, quakes, offset_x, diameter, style) {
    let points = quakes.map((quake) => {
      const lat = quake["data"]["properties"]["lat"];
      const lon = quake["data"]["properties"]["lon"];
      return [lon, lat];
    });

    points = degreesToRadians(points);
    points = projectPoints(points, offset_x, diameter);

    points = points.filter(function (point) {
      return point !== undefined;
    });

    // Scale markers for mobile devices (match CSS media query)
    const isMobile = window.screen.width <= 768 || window.innerWidth <= 768;
    const markerScale = isMobile ? 2.25 : 1;
    const markerRadius = (diameter / 60) * markerScale;
    const strokeWidth = isMobile ? 6 : 4.5;

    points.map((point) => {
      ctx.beginPath();
      ctx.moveTo(point[0], -point[1]);
      ctx.arc(point[0], -point[1], markerRadius, 0, Math.PI * 2, false);
      ctx.fillStyle = style;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point[0], -point[1], markerRadius, 0, Math.PI * 2, false);
      ctx.fillStyle = "black";
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    });
  };

  degreesToRadians = (points) => {
    // convert to radians
    points = points.map((point) => [
      (point[0] * Math.PI) / 180,
      (point[1] * Math.PI) / 180,
    ]);
    return points;
  };

  projectPoints = function (points, offset_x, diameter) {
    // Project land features on to a flat circle.

    // Rotate according to offset.
    points = rotatePoints(points, offset_x);

    // Filter out back of globe.
    points = points.filter(
      (point) =>
        point[0] <= Math.PI / 2 &&
        point[0] >= -Math.PI / 2 &&
        point[1] <= Math.PI / 2 &&
        point[1] >= -Math.PI / 2
    );

    // Project onto circle.
    points = points.map((point) => [
      Math.cos(point[1]) * Math.sin(point[0]),
      Math.sin(point[1]),
    ]);

    // Scale.
    points = points.map((point) => [
      (point[0] * diameter) / 2,
      (point[1] * diameter) / 2,
    ]);
    return points;
  };

  drawGlobe = function (ctx, features, offset_x, diameter) {
    // add ocean
    ctx.beginPath();
    ctx.arc(0, 0, globe.diameter / 2, 0, Math.PI * 2);
    ctx.fillStyle = globe.dark_mode_ocean;
    ctx.fill();

    features = features.map((points) => {
      return projectPoints(points, globe.offset_x, diameter);
    });

    features.map((points) => {
      drawPoints(ctx, diameter, points);
    });

    // Add border for light theme.
    if (getTheme() === "light") {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.arc(0, 0, diameter / 2, 0, Math.PI * 2, false);
      //ctx.fillStyle = globe.light_mode_ocean;
      ctx.fillStyle = globe.light_mode_ocean;
      ctx.stroke();
    }
  };

  rotatePoints = function (points, delta_x) {
    rotated_points = points.map((point) => {
      let rotated_point = Array();

      rotated_point[0] = point[0] + delta_x;
      rotated_point[1] = point[1];

      // wrap around if necessary
      if (rotated_point[0] > Math.PI) {
        rotated_point[0] = rotated_point[0] - 2 * Math.PI;
      } else if (rotated_point[0] < -Math.PI) {
        rotated_point[0] = rotated_point[0] + 2 * Math.PI;
      }

      if (rotated_point[1] > Math.PI / 2) {
        rotated_point[1] = -1 * (rotated_point[1] - Math.PI);
      } else if (rotated_point[1] < -Math.PI / 2) {
        rotated_point[1] = -1 * (rotated_point[1] + Math.PI);
      }

      return rotated_point;
    });

    return rotated_points;
  };

  farApart = function (point1, point2, diameter) {
    // Are two points far from one another on the globe?
    if (
      Math.abs(point1[0] - point2[0]) > (0.1 * diameter) / 2 ||
      Math.abs(point1[1] - point2[1]) > (0.1 * diameter) / 2
    ) {
      return true;
    } else {
      return false;
    }
  };

  drawPoints = function (ctx, diameter, points) {
    // Draw regions on the canvas.
    ctx.beginPath();
    points.map((point, i) => {
      {
        if (i > 0) {
          if (farApart(point, points[i - 1], diameter)) {
            // If two points are far from each other, they are on the edge of the globe and must be connected by an arc.
            edgeCaseArc(ctx, diameter, points[i - 1], point, i);
          } else {
            ctx.lineTo(point[0], -point[1]);
          }
        } else {
          // Handle the two points at the beginning and end of the array.
          if (farApart(point, points.slice(-1).pop(), diameter)) {
            edgeCaseArc(ctx, diameter, points.slice(-1).pop(), point, i);
          } else {
            ctx.moveTo(point[0], -point[1]);
          }
        }
      }
    });

    low_latitude = points.filter((point) => point[1] < -diameter / 2.5);

    // Respect theme.
    if (globe.colorScheme === "dark") {
      ctx.fillStyle = globe.dark_mode_land;
    } else {
      ctx.fillStyle = globe.light_mode_land;
    }

    if (low_latitude.length === points.length) {
      ctx.fillStyle = "#d1e4ff";
    }

    ctx.fill();
  };

  cartToAngle = function (x, y) {
    // Convert cartesian coordinates to an angle starting at the positive X axis.
    let angle = 0;

    if (0 < x && 0 < y) {
      angle = Math.atan(y / x);
    } else if ((x < 0 && 0 < y) || (x < 0 && y < 0)) {
      angle = Math.atan(y / x) + Math.PI;
    } else if (0 < x && y < 0) {
      angle = Math.atan(y / x) + Math.PI * 2;
    }
    return angle;
  };

  edgeCaseArc = function (ctx, diameter, point1, point2, i) {
    const start_angle = cartToAngle(point1[0], -point1[1]);
    const end_angle = cartToAngle(point2[0], -point2[1]);

    // Draw an arc in the direction of the sweep unless it passes over the positive x axis.
    ctx.arc(
      0,
      0,
      diameter / 2, // radius
      start_angle,
      end_angle,
      !clockwise(start_angle, end_angle)
    );
  };

  clockwise = function (start_angle, end_angle) {
    // Whether the arc should be drawn clockwise or counterclockwise.
    if (start_angle > end_angle) {
      if (start_angle - end_angle < Math.PI) {
        return false;
      } else {
        return true;
      }
    } else {
      if (end_angle - start_angle > Math.PI) {
        return false;
      } else {
        return true;
      }
    }
  };
})();
