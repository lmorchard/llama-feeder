import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeed extends LitElement {
  static properties = {
    feedId: { type: String },
    newestItemDate: { type: Number },
    title: { type: String },
    link: { type: String },
    feed: { attribute: false, type: Object },
    items: { attribute: false, type: Array },
  };

  constructor() {
    super();
    this.loaded = false;
    this.items = [];
  }

  createRenderRoot() {
    return this;
  }

  get parent() {
    return this.closest("feeder-feeds-list");
  }

  get apiUrl() {
    return this.parent.getAttribute("baseApiUrl");
  }

  get maxage() {
    return parseInt(this.parent.getAttribute("maxage"), 10);
  }

  onVisible() {
    if (this.loaded) return;
    this.loaded = true;
    this.loadFeed();
  }

  async loadFeed() {
    const feedId = this.getAttribute("feedId");
    const url = `${this.apiUrl}/feeds/${feedId}?maxage=${this.maxage}`;
    const response = await fetch(url);
    const { feed, items } = await response.json();

    this.feed = feed;
    this.items = items;
  }

  render() {
    const newestItemDate = new Date(
      this.feed?.newestItemDate || this.newestItemDate
    );
    const newestItemDateDisplay = newestItemDate.toLocaleString();

    return html`
      <details open=${!!this.feed}>
        <summary><a href="${this.feed?.link}">${this.title}</a></summary>
        <section class="items">
          <ul>
            ${this.items &&
            this.items.map(
              (item) => html`
                <li><feeder-feed-item .item=${item}></feeder-feed-item></li>
              `
            )}
          </ul>
        </section>
      </details>
    `;
  }
}

customElements.define("feeder-feed", FeederFeed);
