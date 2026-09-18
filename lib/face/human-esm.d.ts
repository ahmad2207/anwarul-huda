// The package's own types only cover its top level specifier
// ("@vladmandic/human"), not this specific dist subpath. This route
// imports the subpath directly rather than the bare specifier (see
// app/account/face/face-capture.tsx for why), so it needs its own
// declaration, re-exporting the same default the top level package
// already declares.
declare module "@vladmandic/human/dist/human.esm.js" {
  import Human from "@vladmandic/human";

  export default Human;
}
