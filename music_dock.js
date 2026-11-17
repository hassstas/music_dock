class VinylPlayerCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Выберите media player");
    }

    this._config = {
      entity: config.entity,

      slider_entity:
        config.slider_entity || "",

      slider_attribute:
        config.slider_attribute || "auto",

      right_slider_entity:
        config.right_slider_entity || "",

      right_slider_attribute:
        config.right_slider_attribute || "auto",

      title: config.title || "",
      theme_aware: config.theme_aware !== false,
      background:
        config.background ||
        "linear-gradient(135deg, #1d1f24, #101215)",
      spin_duration: Number(config.spin_duration) || 7,
      swipe_enabled: config.swipe_enabled !== false,
      swipe_min_distance:
        Number(config.swipe_min_distance) || 45,

      card_height:
        Number(config.card_height) || 5,

      volume_swipe_zone: 30,

      right_volume_swipe_zone: 30,

      volume_swipe_step:
        Number(config.volume_swipe_step) || 0.05,

      show_volume_indicator:
        config.show_volume_indicator !== false,

      left_icon:
        config.left_icon || "mdi:skip-previous",

      right_icon:
        config.right_icon || "mdi:skip-next",

      left_button: config.left_button || {
        tap_action: {
          action: "perform-action",
          perform_action:
            "media_player.media_previous_track",
          target: {
            entity_id: config.entity
          }
        }
      },

      right_button: config.right_button || {
        tap_action: {
          action: "perform-action",
          perform_action:
            "media_player.media_next_track",
          target: {
            entity_id: config.entity
          }
        }
      }
    };

    this._lastTouchWasSwipe = false;

    if (!this._rendered) {
      this._render();
      this._rendered = true;
    }

    if (this.shadowRoot) {
      this._applyConfig();
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    return this._config?.card_height || 5;
  }

  getGridOptions() {
    const rows = Math.min(
      12,
      Math.max(2, Number(this._config?.card_height) || 5)
    );

    return {
      columns: 12,
      rows,
      min_columns: 6,
      min_rows: 2,
      max_rows: 12
    };
  }

  _entity() {
    return this._hass?.states?.[this._config.entity];
  }

  _sliderEntity(side = "left") {
    const entityId =
      side === "right"
        ? this._config.right_slider_entity ||
          this._config.entity
        : this._config.slider_entity ||
          this._config.entity;

    if (!entityId) {
      return null;
    }

    return this._hass?.states?.[entityId] || null;
  }

  _sliderAttribute(side = "left") {
    const entityId =
      side === "right"
        ? this._config.right_slider_entity ||
          this._config.entity
        : this._config.slider_entity ||
          this._config.entity;

    if (!entityId) {
      return null;
    }

    const domain = entityId.split(".")[0];

    const configuredAttribute =
      side === "right"
        ? this._config.right_slider_attribute
        : this._config.slider_attribute;

    if (configuredAttribute !== "auto") {
      return configuredAttribute;
    }

    if (domain === "media_player") {
      return "volume_level";
    }

    if (domain === "light") {
      return "brightness";
    }

    return null;
  }

  _sliderValue(side = "left") {
    const state = this._sliderEntity(side);
    const attribute = this._sliderAttribute(side);

    if (!state || !attribute) {
      return null;
    }

    const value = Number(state.attributes?.[attribute]);

    if (Number.isNaN(value)) {
      return null;
    }

    if (attribute === "volume_level") {
      return Math.min(1, Math.max(0, value));
    }

    if (attribute === "brightness") {
      return Math.min(
        1,
        Math.max(0, value / 255)
      );
    }

    return null;
  }

  async _setSliderValue(
    normalizedValue,
    side = "left"
  ) {
    const entityId =
      side === "right"
        ? this._config.right_slider_entity ||
          this._config.entity
        : this._config.slider_entity ||
          this._config.entity;

    const attribute = this._sliderAttribute(side);

    if (!entityId || !attribute) {
      return;
    }

    const value = Math.min(
      1,
      Math.max(0, normalizedValue)
    );

    if (attribute === "volume_level") {
      await this._callService(
        "media_player",
        "volume_set",
        {
          volume_level: value
        },
        {
          entity_id: entityId
        }
      );

      return;
    }

    if (attribute === "brightness") {
      const brightness = Math.round(value * 255);

      await this._callService(
        "light",
        "turn_on",
        {
          brightness
        },
        {
          entity_id: entityId
        }
      );
    }
  }

  _render() {
    this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          container-type: size;
          container-name: vinyl-card;

          --vp-volume-zone-width: 30px;
          --vp-right-volume-zone-width: 30px;
          --vp-volume-level: 0%;
          --vp-right-volume-level: 0%;
          --vp-volume-color: var(--primary-color, #ff5a5f);
          --vp-right-volume-color: var(--primary-color, #ff5a5f);

          --vp-background:
            linear-gradient(
              135deg,
              var(--secondary-background-color, #1d1f24),
              var(--primary-background-color, #101215)
            );

          --vp-button-background: rgba(
            var(--rgb-primary-text-color, 255, 255, 255),
            .10
          );

          --vp-button-background-hover: rgba(
            var(--rgb-primary-text-color, 255, 255, 255),
            .18
          );

          --vp-vinyl-color: #0d0d0d;
          --vp-accent-color: var(--primary-color, #ff5a5f);
        }

        .card {
          position: relative;
          display: grid;
          grid-template-columns:
            var(--vp-volume-zone-width, 30px)
            auto
            auto
            auto
            var(--vp-right-volume-zone-width, 30px);
          grid-template-areas:
            "left-slider prev-button vinyl next-button right-slider";
          align-items: center;
          width: 100%;
          height: 100%;
          min-height: 170px;
          padding: clamp(14px, 4cqw, 20px);
          padding: 0;
          padding-right: 0;
          // padding-bottom: clamp(46px, 12cqw, 58px);
          border-radius: var(--ha-card-border-radius, 1vw);
          color: var(--primary-text-color, #fff);
          background: var(--ha-card-background, var(--card-background-color, #1d1f24));
          overflow: hidden;
          user-select: none;
          box-shadow: var(--ha-card-box-shadow, 0 10px 30px rgba(0, 0, 0, .18));
          box-sizing: border-box;
        }

        .background {
          position: absolute;
          inset: 0;
          background: var(--vp-background);
          z-index: 0;
        }

        .side {
          position: relative;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .track-button {
          width: clamp(54px, 17cqw, 74px);
          height: clamp(54px, 17cqw, 74px);
          border: none;
          border-radius: 50%;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--primary-text-color, #fff);
          background: var(--vp-button-background);
          backdrop-filter: blur(10px);
          box-shadow: var(--ha-card-box-shadow, 0 6px 18px rgba(0, 0, 0, .25));
          transition:
            transform .16s ease,
            background .16s ease,
            opacity .16s ease;
        }

        .track-button:hover {
          background: var(--vp-button-background-hover);
        }

        .track-button:active {
          transform: scale(.94);
        }

        .track-button:disabled {
          opacity: .35;
          cursor: not-allowed;
          transform: none;
        }

        .track-button ha-icon {
          width: 26px;
          height: 26px;
          font-size: 26px;
          margin-top: -0.2em;
          color: currentColor;
          pointer-events: none;
        }

        .prev {
          margin-right: 0;
        }
        
        .next {
          margin-left: 0;
        }

        .vinyl-wrap {
          position: relative;
          z-index: 2;
          width: clamp(130px, 40cqw, 175px);
          height: clamp(130px, 40cqw, 175px);
          justify-self: center;
          cursor: pointer;
          grid-area: vinyl;
        }

        .vinyl {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            repeating-radial-gradient(
              circle at center,
              rgba(255, 255, 255, .035) 0 1px,
              transparent 1px 5px
            ),
            radial-gradient(
              circle at center,
              #1a1a1a 0%,
              #0d0d0d 65%,
              #050505 100%
            );
          box-shadow:
            0 12px 28px rgba(0, 0, 0, .5),
            inset 0 0 0 2px rgba(255, 255, 255, .05);
          animation: vinyl-spin 7s linear infinite;
          animation-play-state: paused;
          transition: transform .1s ease;
        }

        .playing .vinyl {
          animation-play-state: running;
        }

        .vinyl-wrap:active .vinyl {
          transform: scale(.98);
        }

        .cover,
        .cover-fallback {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 48%;
          height: 48%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, .14);
          z-index: 2;
        }

        .cover {
          object-fit: cover;
          object-position: center;
          background: #222;
        }

        .cover-fallback {
          display: grid;
          place-items: center;
          font-size: clamp(22px, 8cqw, 30px);
          color: rgba(255, 255, 255, .75);
          background: #26282d;
        }

        .label {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 13%;
          height: 13%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: #0a0a0a;
          z-index: 3;
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, .08),
            0 0 0 4px rgba(0, 0, 0, .55);
        }

        .volume-zone {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: var(--vp-volume-zone-width, 30px);
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          opacity: 0;
          transition: opacity .45s ease;
          grid-area: left-slider;
        }

        .volume-zone.right {
          left: auto;
          right: 0;
          width: var(--vp-right-volume-zone-width, 30px);
          grid-area: right-slider;
        }

        .volume-zone.active {
          opacity: 1;
        }

        .side.prev-side {
          grid-area: prev-button;
        }
        
        .side.next-side {
          grid-area: next-button;
        }

        .volume-track {
          position: relative;
          width: 5px;
          height: 90%;
          border-radius: 999px;
          background: rgba(
            var(--rgb-primary-text-color, 255, 255, 255),
            .16
          );
          overflow: hidden;
        }

        .volume-fill {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: var(--vp-volume-level, 0%);
          border-radius: 999px;
          background: var(--vp-volume-color, var(--primary-color, #ff5a5f));
          transition: height .18s ease;
        }

        .volume-zone.right .volume-fill {
          height: var(--vp-right-volume-level, 0%);
          background: var(--vp-right-volume-color, var(--primary-color, #ff5a5f));
        }

        .info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: clamp(10px, 3cqw, 14px);
          z-index: 4;
          text-align: center;
          padding: 0 clamp(64px, 20cqw, 92px);
          pointer-events: none;
        }

        .track-line {
          font-size: clamp(12px, 3.4cqw, 15px);
          font-weight: 650;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .track-artist {
          opacity: .72;
          font-weight: 450;
        }

        .state {
          margin-top: 4px;
          font-size: clamp(9px, 2.7cqw, 11px);
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--vp-accent-color);
        }

        .header {
          position: absolute;
          top: clamp(10px, 3cqw, 14px);
          left: 16px;
          right: 16px;
          z-index: 4;
          font-size: clamp(9px, 2.7cqw, 11px);
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .55;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @container vinyl-card (max-width: 360px) {
          .card {
            min-height: 150px;
          }

          .vinyl-wrap {
            width: 118px;
            height: 118px;
          }

          .track-button {
            width: 48px;
            height: 48px;
          }

          .track-button ha-icon {
            width: 22px;
            height: 22px;
            font-size: 22px;
          }

          .prev {
            margin-right: -0;
          }

          .next {
            margin-left: -0;
          }

          .info {
            padding: 0 54px;
          }

          .track-line {
            font-size: 11.5px;
          }
        }

        @container vinyl-card (min-width: 560px) {
          .card {
            min-height: 190px;
          }

          .vinyl-wrap {
            aspect-ratio: 1/1;
            height: 90%;
            width: auto;
          }

          .track-button {
            width: 78px;
            height: 78px;
          }

          .track-button ha-icon {
            width: 28px;
            height: 28px;
            font-size: 28px;
          }

          .prev {
            margin-right: -0;
          }

          .next {
            margin-left: -0;
          }

          .info {
            padding: 0 104px;
          }
        }

        @keyframes vinyl-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      </style>

      <div class="card" id="card">
        <div class="background"></div>

        <div class="volume-zone" id="volumeZone">
          <div class="volume-track">
            <div class="volume-fill" id="volumeFill"></div>
          </div>
        </div>

        <div class="side prev-side">
          <button
            class="track-button prev"
            id="prev"
            title="Действие левой кнопки"
          >
            <ha-icon id="leftIcon"></ha-icon>
          </button>
        </div>

        <div class="vinyl-wrap" id="vinylWrap">
          <div class="vinyl">
            <img class="cover" id="cover" alt="" />

            <div
              class="cover-fallback"
              id="coverFallback"
            >
              ♪
            </div>

            <div class="label"></div>
          </div>
        </div>

        <div class="side next-side">
          <button
            class="track-button next"
            id="next"
            title="Действие правой кнопки"
          >
            <ha-icon id="rightIcon"></ha-icon>
          </button>
        </div>

        <div
          class="volume-zone right"
          id="rightVolumeZone"
        >
          <div class="volume-track">
            <div
              class="volume-fill"
              id="rightVolumeFill"
            ></div>
          </div>
        </div>

        <div class="header" id="header"></div>

        <div class="info">
          <div class="track-line" id="trackLine">
            Нет трека
          </div>

          <div class="state" id="state"></div>
        </div>
      </div>
    `;

    const leftButton = this.shadowRoot.getElementById("prev");
    const rightButton = this.shadowRoot.getElementById("next");

    leftButton.addEventListener("click", () => {
      this._runAction(
        this._config.left_button?.tap_action
      );
    });

    rightButton.addEventListener("click", () => {
      this._runAction(
        this._config.right_button?.tap_action
      );
    });

    leftButton.addEventListener("contextmenu", (event) => {
      event.preventDefault();

      this._runAction(
        this._config.left_button?.hold_action
      );
    });

    rightButton.addEventListener("contextmenu", (event) => {
      event.preventDefault();

      this._runAction(
        this._config.right_button?.hold_action
      );
    });

    leftButton.addEventListener("dblclick", () => {
      this._runAction(
        this._config.left_button?.double_tap_action
      );
    });

    rightButton.addEventListener("dblclick", () => {
      this._runAction(
        this._config.right_button?.double_tap_action
      );
    });

    this._addSwipeSupport();
    this._addVinylTapSupport();
  }

  _applyConfig() {
    const root = this.shadowRoot.host;

    if (this._config.theme_aware) {
      root.style.removeProperty("--vp-vinyl-color");
      root.style.removeProperty("--vp-accent-color");
      root.style.removeProperty("--vp-background");
      root.style.removeProperty("--ha-card-border-radius");

      root.style.setProperty(
        "--vp-vinyl-color",
        "#0d0d0d"
      );

      root.style.setProperty(
        "--vp-accent-color",
        "var(--primary-color, #ff5a5f)"
      );

      root.style.setProperty(
        "--vp-background",
        "var(--vp-theme-background)"
      );
    } else {
      root.style.setProperty(
        "--vp-background",
        this._config.background
      );
      root.style.setProperty(
        "--ha-card-border-radius",
        "1vw"
      );
    }

    root.style.setProperty(
      "--vp-volume-zone-width",
      `${this._config.volume_swipe_zone}px`
    );

    root.style.setProperty(
      "--vp-right-volume-zone-width",
      `${this._config.right_volume_swipe_zone}px`
    );

    const vinyl = this.shadowRoot.querySelector(".vinyl");

    if (vinyl) {
      vinyl.style.animationDuration =
        `${this._config.spin_duration}s`;
    }

    const leftIcon = this.shadowRoot.getElementById("leftIcon");
    const rightIcon = this.shadowRoot.getElementById("rightIcon");

    if (leftIcon) {
      leftIcon.setAttribute("icon", this._config.left_icon);
    }

    if (rightIcon) {
      rightIcon.setAttribute("icon", this._config.right_icon);
    }
  }

  _update() {
    const state = this._entity();

    if (!state || !this.shadowRoot) {
      return;
    }

    const attrs = state.attributes;
    const isPlaying = state.state === "playing";
    const artwork =
      attrs.entity_picture_local || attrs.entity_picture || "";

    const leftSliderValue = this._sliderValue("left");
    const rightSliderValue = this._sliderValue("right");

    const card = this.shadowRoot.getElementById("card");
    const cover = this.shadowRoot.getElementById("cover");
    const fallback = this.shadowRoot.getElementById("coverFallback");
    const trackLine = this.shadowRoot.getElementById("trackLine");

    card.classList.toggle("playing", isPlaying);

    const title = attrs.media_title || "Нет трека";
    const artist = attrs.media_artist || "";

    trackLine.innerHTML = "";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    trackLine.appendChild(titleSpan);

    if (artist) {
      const separator = document.createElement("span");
      separator.textContent = " — ";
      trackLine.appendChild(separator);

      const artistSpan = document.createElement("span");
      artistSpan.className = "track-artist";
      artistSpan.textContent = artist;
      trackLine.appendChild(artistSpan);
    }

    this.shadowRoot.getElementById("state").textContent =
      state.state === "playing" ? "Играет" :
      state.state === "paused" ? "Пауза" :
      state.state === "idle" ? "Ожидание" :
      state.state === "off" ? "Выключен" :
      state.state;

    if (artwork) {
      cover.src = artwork;
      cover.style.display = "block";
      fallback.style.display = "none";
    } else {
      cover.removeAttribute("src");
      cover.style.display = "none";
      fallback.style.display = "grid";
    }

    this.shadowRoot.getElementById("header").textContent =
      this._config.title;

    this._applyConfig();

    const updateSliderFill = (fill, value) => {
      if (!fill) {
        return;
      }

      const clampedValue =
        value === null ? 0 : value;

      const percent = Math.round(clampedValue * 100);

      fill.style.setProperty(
        "--vp-volume-level",
        `${percent}%`
      );

      let fillColor;

      if (clampedValue < .25) {
        fillColor = "#4caf50";
      } else if (clampedValue < .55) {
        fillColor = "#8bc34a";
      } else if (clampedValue < .8) {
        fillColor = "#ffb300";
      } else if (clampedValue < .95) {
        fillColor = "#ff7043";
      } else {
        fillColor = "#f44336";
      }

      fill.style.setProperty(
        "--vp-volume-color",
        fillColor
      );
      
      fill.style.setProperty(
        "--vp-right-volume-level",
        `${percent}%`
      );

      // let fillRColor;

      if (clampedValue < .25) {
        fillColor = "#4caf50";
      } else if (clampedValue < .55) {
        fillColor = "#8bc34a";
      } else if (clampedValue < .8) {
        fillColor = "#ffb300";
      } else if (clampedValue < .95) {
        fillColor = "#ff7043";
      } else {
        fillColor = "#f44336";
      }

      fill.style.setProperty(
        "--vp-right-volume-color",
        fillColor
      );
      
    };

    updateSliderFill(
      this.shadowRoot.getElementById("volumeFill"),
      leftSliderValue
    );

    updateSliderFill(
      this.shadowRoot.getElementById("rightVolumeFill"),
      rightSliderValue
    );

    const canPrevious =
      (attrs.supported_features & 16) !== 0;

    const canNext =
      (attrs.supported_features & 32) !== 0;

    this.shadowRoot.getElementById("prev").disabled =
      !canPrevious;

    this.shadowRoot.getElementById("next").disabled =
      !canNext;
  }

  async _callService(
    domain,
    service,
    data = {},
    target = {}
  ) {
    await this._hass.callService(
      domain,
      service,
      data,
      target
    );
  }

  async _runAction(actionConfig) {
    if (!actionConfig || actionConfig.action === "none") {
      return;
    }

    const action = actionConfig.action;

    if (action === "perform-action") {
      const service = actionConfig.perform_action;

      if (!service) {
        return;
      }

      const [domain, serviceName] = service.split(".");

      if (domain === "script") {
        await this._callService(
          "script",
          "turn_on",
          {},
          {
            entity_id: service
          }
        );

        return;
      }

      await this._callService(
        domain,
        serviceName,
        actionConfig.data || {},
        actionConfig.target || {}
      );

      return;
    }

    if (action === "more-info") {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: {
            entityId:
              actionConfig.entity || this._config.entity
          }
        })
      );

      return;
    }

    if (action === "navigate") {
      history.pushState(
        null,
        "",
        actionConfig.navigation_path
      );

      window.dispatchEvent(
        new CustomEvent("location-changed", {
          bubbles: true,
          composed: true
        })
      );

      return;
    }

    if (action === "url") {
      window.open(actionConfig.url_path, "_blank");
      return;
    }

    if (action === "assist") {
      this.dispatchEvent(
        new CustomEvent("hass-assist-pipeline", {
          bubbles: true,
          composed: true,
          detail: {
            start_listening:
              actionConfig.start_listening !== false,
            pipeline_id:
              actionConfig.pipeline_id || "last_used"
          }
        })
      );
    }
  }

  _addSwipeSupport() {
    if (!this._config.swipe_enabled) {
      return;
    }

    const card = this.shadowRoot.getElementById("card");
    const leftZone =
      this.shadowRoot.getElementById("volumeZone");
    const rightZone =
      this.shadowRoot.getElementById("rightVolumeZone");
    const leftFill =
      this.shadowRoot.getElementById("volumeFill");
    const rightFill =
      this.shadowRoot.getElementById("rightVolumeFill");

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isSwipe = false;
    let activeSlider = null;
    let startValue = 0;
    let targetValue = 0;
    let lastSentValue = null;
    let lastSentTime = 0;

    const setSliderValue = (value, force = false) => {
      const now = Date.now();

      if (!force && now - lastSentTime < 120) {
        return;
      }

      lastSentTime = now;
      lastSentValue = value;

      this._setSliderValue(value, activeSlider);
    };

    const updateSliderUi = (value) => {
      const clampedValue = Math.min(
        1,
        Math.max(0, value)
      );

      const percent = Math.round(clampedValue * 100);

      const fill =
        activeSlider === "right"
          ? rightFill
          : leftFill;

      fill?.style.setProperty(
        "--vp-volume-level",
        `${percent}%`
      );
    };

    card.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          isSwipe = false;
          activeSlider = null;
          return;
        }

        const touch = event.touches[0];
        const cardRect = card.getBoundingClientRect();
        const relativeX = touch.clientX - cardRect.left;
        const distanceFromRight =
          cardRect.right - touch.clientX;

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isSwipe = true;

        const isLeftSlider =
          relativeX <= this._config.volume_swipe_zone;

        const isRightSlider =
          distanceFromRight <=
          this._config.right_volume_swipe_zone;

        activeSlider = isLeftSlider
          ? "left"
          : isRightSlider
            ? "right"
            : null;

        if (activeSlider) {
          const currentValue = this._sliderValue(
            activeSlider
          );

          startValue = currentValue === null
            ? 0
            : currentValue;

          targetValue = startValue;
          lastSentValue = startValue;
          lastSentTime = 0;

          updateSliderUi(targetValue);
        }

        const activeZone =
          activeSlider === "right"
            ? rightZone
            : leftZone;

        leftZone?.classList.remove("active");
        rightZone?.classList.remove("active");

        activeZone?.classList.toggle(
          "active",
          Boolean(activeSlider)
        );
      },
      { passive: true }
    );

    card.addEventListener(
      "touchmove",
      (event) => {
        if (!isSwipe || event.touches.length !== 1) {
          return;
        }

        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = touch.clientY - startY;

        if (activeSlider) {
          const cardRect = card.getBoundingClientRect();
          const volumeRange = cardRect.height * 0.75;

          const valueDelta =
            volumeRange > 0
              ? -deltaY / volumeRange
              : 0;

          targetValue = Math.min(
            1,
            Math.max(
              0,
              startValue + valueDelta
            )
          );

          updateSliderUi(targetValue);

          if (
            lastSentValue === null ||
            Math.abs(targetValue - lastSentValue) >= 0.01
          ) {
            setSliderValue(targetValue);
          }

          return;
        }

        if (deltaY > deltaX) {
          isSwipe = false;
        }
      },
      { passive: true }
    );

    card.addEventListener(
      "touchend",
      (event) => {
        if (!isSwipe || event.changedTouches.length !== 1) {
          return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const elapsed = Date.now() - startTime;

        isSwipe = false;

        leftZone?.classList.remove("active");
        rightZone?.classList.remove("active");

        if (activeSlider) {
          this._setSliderValue(
            targetValue,
            activeSlider
          );

          activeSlider = null;
          return;
        }

        if (elapsed > 700) {
          return;
        }

        if (deltaY > 50) {
          return;
        }

        if (
          Math.abs(deltaX) <
          this._config.swipe_min_distance
        ) {
          return;
        }

        this._lastTouchWasSwipe = true;

        if (deltaX < 0) {
          this._callService(
            "media_player",
            "media_next_track",
            {},
            { entity_id: this._config.entity }
          );
        } else {
          this._callService(
            "media_player",
            "media_previous_track",
            {},
            { entity_id: this._config.entity }
          );
        }
      },
      { passive: true }
    );

    card.addEventListener(
      "touchcancel",
      () => {
        isSwipe = false;
        activeSlider = null;

        leftZone?.classList.remove("active");
        rightZone?.classList.remove("active");
      },
      { passive: true }
    );
  }

  _addVinylTapSupport() {
    const vinylWrap = this.shadowRoot.getElementById("vinylWrap");

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTap = false;

    vinylWrap.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          isTap = false;
          return;
        }

        const touch = event.touches[0];

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isTap = true;
      },
      { passive: true }
    );

    vinylWrap.addEventListener(
      "touchmove",
      (event) => {
        if (!isTap || event.touches.length !== 1) {
          return;
        }

        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);

        if (deltaX > 12 || deltaY > 12) {
          isTap = false;
        }
      },
      { passive: true }
    );

    vinylWrap.addEventListener(
      "touchend",
      (event) => {
        if (!isTap || event.changedTouches.length !== 1) {
          return;
        }

        const touch = event.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        const elapsed = Date.now() - startTime;

        isTap = false;

        if (
          deltaX > 12 ||
          deltaY > 12 ||
          elapsed > 500
        ) {
          return;
        }

        if (this._lastTouchWasSwipe) {
          this._lastTouchWasSwipe = false;
          return;
        }

        this._callService(
          "media_player",
          "media_play_pause",
          {},
          { entity_id: this._config.entity }
        );
      },
      { passive: true }
    );

    vinylWrap.addEventListener(
      "touchcancel",
      () => {
        isTap = false;
      },
      { passive: true }
    );

    vinylWrap.addEventListener("click", () => {
      if (this._lastTouchWasSwipe) {
        this._lastTouchWasSwipe = false;
        return;
      }

      this._callService(
        "media_player",
        "media_play_pause",
        {},
        { entity_id: this._config.entity }
      );
    });
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "entity",
          label: "Медиаплеер",
          required: true,
          selector: {
            entity: {
              filter: {
                domain: "media_player"
              }
            }
          }
        },
        {
          name: "slider_entity",
          label: "Сущность левого слайдера",
          selector: {
            entity: {
              multiple: false,
              filter: [
                {
                  domain: "media_player"
                },
                {
                  domain: "light"
                }
              ]
            }
          }
        },
        {
          name: "right_slider_entity",
          label: "Сущность правого слайдера",
          selector: {
            entity: {
              multiple: false,
              filter: [
                {
                  domain: "media_player"
                },
                {
                  domain: "light"
                }
              ]
            }
          }
        },
        {
          name: "title",
          label: "Заголовок",
          selector: {
            text: {}
          }
        },
        {
          name: "card_height",
          label: "Высота карточки, строк",
          selector: {
            number: {
              min: 2,
              max: 12,
              step: 1,
              mode: "slider"
            }
          }
        },
        {
          name: "theme_aware",
          label: "Следовать теме Home Assistant",
          selector: {
            boolean: {}
          }
        },
        {
          name: "background",
          label: "Фон карточки",
          selector: {
            text: {}
          }
        },
        {
          name: "spin_duration",
          label: "Оборот пластинки, секунд",
          selector: {
            number: {
              min: 2,
              max: 30,
              step: 0.5,
              mode: "slider"
            }
          }
        },
        {
          name: "swipe_enabled",
          label: "Свайп для переключения треков",
          selector: {
            boolean: {}
          }
        },
        {
          name: "swipe_min_distance",
          label: "Минимальная длина свайпа, px",
          selector: {
            number: {
              min: 20,
              max: 150,
              step: 5,
              mode: "box"
            }
          }
        },
        {
          name: "volume_swipe_step",
          label: "Шаг громкости за свайп",
          selector: {
            number: {
              min: 0.01,
              max: 0.25,
              step: 0.01,
              mode: "slider"
            }
          }
        },
        {
          name: "show_volume_indicator",
          label: "Показывать индикатор громкости",
          selector: {
            boolean: {}
          }
        },
        {
          name: "left_icon",
          label: "Иконка левой кнопки",
          selector: {
            icon: {}
          }
        },
        {
          name: "left_button",
          label: "Действие левой кнопки",
          selector: {
            object: {}
          }
        },
        {
          name: "right_icon",
          label: "Иконка правой кнопки",
          selector: {
            icon: {}
          }
        },
        {
          name: "right_button",
          label: "Действие правой кнопки",
          selector: {
            object: {}
          }
        }
      ],
      computeLabel: (schema) => schema.label,
      computeHelper: (schema) => {
        if (schema.name === "slider_entity") {
          return "Если не выбрано, будет использоваться основной медиаплеер";
        }

        if (schema.name === "right_slider_entity") {
          return "Если не выбрано, будет использоваться основной медиаплеер";
        }

        if (schema.name === "card_height") {
          return "Количество строк сетки Home Assistant, которое займёт карточка";
        }

        if (schema.name === "background") {
          return "CSS-градиент, например: linear-gradient(135deg, #1d1f24, #101215)";
        }

        if (schema.name === "spin_duration") {
          return "Время одного полного оборота пластинки";
        }

        if (schema.name === "swipe_min_distance") {
          return "Меньше значение — более чувствительный свайп";
        }

        if (schema.name === "volume_swipe_step") {
          return "Изменение громкости за один вертикальный свайп, от 0 до 1";
        }

        if (schema.name === "left_button") {
          return "YAML-объект действия, например tap_action";
        }

        if (schema.name === "right_button") {
          return "YAML-объект действия, например tap_action";
        }

        return "";
      }
    };
  }

  static getStubConfig() {
    return {
      entity: "media_player.living_room",
      title: "Музыка",
      theme_aware: true,
      card_height: 5,
      slider_entity: "",
      right_slider_entity: "",
      background:
        "linear-gradient(135deg, #1d1f24, #101215)",
      spin_duration: 7,
      swipe_enabled: true,
      swipe_min_distance: 45,
      volume_swipe_step: 0.05,
      show_volume_indicator: true,
      left_icon: "mdi:skip-previous",
      right_icon: "mdi:skip-next",
      left_button: {
        tap_action: {
          action: "perform-action",
          perform_action:
            "media_player.media_previous_track",
          target: {
            entity_id: "media_player.living_room"
          }
        }
      },
      right_button: {
        tap_action: {
          action: "perform-action",
          perform_action:
            "media_player.media_next_track",
          target: {
            entity_id: "media_player.living_room"
          }
        }
      }
    };
  }
}

customElements.define(
  "vinyl-player-card",
  VinylPlayerCard
);

window.customCards = window.customCards || [];

window.customCards.push({
  type: "music_dock",
  name: "Music Dock Card",
  description:
    "Док для управления музыкальным плеером",
  preview: true
});
