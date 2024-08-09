import { html } from "../html.js";

export const layout = ({ content }) => {
  return html`
    <html>
      <head>
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <link rel="stylesheet" href="/index.css" />
        <script type="module" src="/index.js"></script>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
};
