/** svgo ships a browser bundle without its own type entry; reuse the main types. */
declare module "svgo/dist/svgo.browser.js" {
  export { optimize } from "svgo";
}
