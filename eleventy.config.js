"use strict";

module.exports = function(eleventyConfig) {
eleventyConfig.addPassthroughCopy("css/*");
eleventyConfig.addPassthroughCopy("js/*");
eleventyConfig.addPassthroughCopy("data/*");
  return {
    dir: {
      input: "content",
      // These paths are relative to the content directory
    },
  };

};
