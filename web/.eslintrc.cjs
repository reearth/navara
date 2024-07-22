module.exports = {
  extends: ["reearth/noprettier"],
  overrides: [
    {
      files: [".eslintrc*", ".prettierrc*"],
      extends: ["reearth/commonjs"],
    },
  ],
};
