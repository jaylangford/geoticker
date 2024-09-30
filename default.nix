{
  nixpkgs ? import (fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/5a09cb4b393d58f9ed0d9ca1555016a8543c2ac8.tar.gz";
    sha256 = "sha256-RyJTnTNKhO0yqRpDISk03I/4A67/dp96YRxc86YOPgU=";
  }) { config = {}; overlays = []; },
  system ? builtins.currentSystem
}:
let
  pkgs = nixpkgs;
  inputs = with pkgs; [ nodejs yarn eleventyEnv ];
  eleventyEnv = pkgs.callPackage pkgs.mkYarnModules {
	pname = "website-env";
	version = "0.0.5";

	yarnLock = ./yarn.lock;
	packageJSON = ./package.json;
  };
in
pkgs.stdenvNoCC.mkDerivation {
	pname = "jays-website";
	version = (pkgs.lib.getVersion eleventyEnv.name);

	src = ./.;

	nativeBuildInputs = [
		eleventyEnv
			pkgs.nodejs 
	];

	ELEVENTY_ENVIRONMENT = "prod";

	shellHook = ''
	alias dev-server="npx @11ty/eleventy --serve"
	'';

	configurePhase = ''
		ln -s ${eleventyEnv}/node_modules ./node_modules
		'';

	buildPhase = ''
		npx eleventy
		'';

	installPhase = ''
		cp -ar _site $out
		'';
}
