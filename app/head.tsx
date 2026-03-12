const FAVICON_ICO_URL = "/favicon.ico?v=20260311";
const BRAND_ICON_SVG_URL = "/brand/flowmedi-icon.svg?v=20260311";

export default function Head() {
  return (
    <>
      <link rel="icon" href={FAVICON_ICO_URL} sizes="any" />
      <link rel="icon" href={BRAND_ICON_SVG_URL} type="image/svg+xml" />
      <link rel="shortcut icon" href={FAVICON_ICO_URL} />
      <link rel="apple-touch-icon" href={BRAND_ICON_SVG_URL} />
      <link rel="manifest" href="/brand/site.webmanifest" />
    </>
  );
}
