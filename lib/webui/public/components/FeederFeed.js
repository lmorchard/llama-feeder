import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeed extends LitElement {
  static properties = {
    feedId: { type: String },
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

  get apiUrl() {
    const parent = this.closest("feeder-feeds-list");
    return parent.getAttribute("baseApiUrl");
  }

  onVisible() {
    if (this.loaded) return;
    this.loaded = true;
    this.loadFeed();
  }

  async loadFeed() {
    const feedId = this.getAttribute("feedId");
    const url = `${this.apiUrl}/feeds/${feedId}`;
    const response = await fetch(url);
    const { feed, items } = await response.json();

    console.log("Loaded feed:", feed, items);

    this.feed = feed;
    this.items = items;
  }

  render() {
    if (!this.feed) {
      return html`<div>Loading...</div>`;
    }

    const newestItemDate = new Date(this.feed.newestItemDate);
    const newestItemDateDisplay = newestItemDate.toLocaleString();

    return html`
      <div>
        <header>
          <h2>${this.title} (<time>${newestItemDateDisplay}</time>)</h2>
        </header>
        <section class="items">
          ${this.items.map(
            (item) => html`
              <feeder-feed-item .item=${item}></feeder-feed-item>
            `
          )}
        </section>
      </div>
    `;
  }
}

customElements.define("feeder-feed", FeederFeed);
