// hls.js publishes its light build (no DRM or subtitle parsing; captions are our own) without
// types of its own; it has the full build's API.
declare module "hls.js/light" {
  import Hls from "hls.js";
  export default Hls;
}
