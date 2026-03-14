#!/usr/bin/env node

import fs from "fs";
import zlib, { createGunzip } from "zlib";
import * as tar from "tar-fs";
import { Command } from "commander";
import followRedirects from "follow-redirects";
import path from "path";
import child_process from "child_process";
import { tmpdir } from "os";
import { log } from "@chickenjdk/common";
const { https } = followRedirects;
// We have to use pump because this has to run on node v18, what debian is stuck on
import pump from "pump";
log("dumb", "Loaded deps");
// For node.js v18, as of match 2026 you have to do this in node.js v18 or requests to alpine linux's cdn time out
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
/**
 * Like https.get, but follows redirects and gives a promise
 * @param {string} url
 * @param {Parameters<https["get"]>[1]} options
 * @returns {Promise<import("http")["IncomingMessage"]>}
 */
function getPromise(url, options) {
  log("verbose", `Getting ${url}`);
  return new Promise((resolve, reject) => {
    https.get(url, options, resolve).on("error", reject);
  });
}

const nodeNamesToAlpineNames = {
  arm: "armhf",
  arm64: "aarch64",
  ia32: "x86",
  loong64: "loongarch64",
  mips: null,
  mipsel: null,
  ppc64: "ppc64le",
  riscv64: "riscv64",
  s390x: "s390x",
  x64: "x86_64",
};
const nodeNamesToDebianNames = {
  ...nodeNamesToAlpineNames,
  x64: "amd64",
  mips: "mips",
  mipsel: "mipsel",
  ia32: "i386",
};
// Conversions
const alpineNamesToNodeNames = Object.fromEntries(
  Object.entries(nodeNamesToAlpineNames)
    .filter(([, v]) => v !== null)
    .map((v) => v.reverse()),
);
const alpineNamesToDebianNames = Object.fromEntries(
  Object.entries(alpineNamesToNodeNames).map(([key, value]) => [
    key,
    nodeNamesToDebianNames[value],
  ]),
);
/**
 * Get your cpu architecture with the names alpine linux expects
 * @returns Your cpu architecture in the format alpine linux expects
 */
function getArch() {
  const archName = nodeNamesToAlpineNames[process.arch];
  if (archName === null) {
    throw new Error(
      "Your system is known, but as of alpine linux 3.23, is unsupported",
    );
  } else if (archName === undefined) {
    throw new Error("Unknown system architecture!");
  } else {
    return archName;
  }
}

const ALPINE_VERSION = "latest-stable";
const ARCH = getArch();

const program = new Command();

const REPOS = ["main", "community"].map((v) => ({
  version: ALPINE_VERSION,
  repository: v,
  architecture: ARCH,
}));

const CACHE = "./apk-cache";
const DEBIAN_REPACKAGE_BASE = path.join("deb-support", "wrapper");

const OUTPUT = "./packages";
const OUTPUT_APK = path.join(OUTPUT, "apk");
const OUTPUT_DEB = path.join(OUTPUT, "deb");

if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE);
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT);
if (!fs.existsSync(OUTPUT_APK)) fs.mkdirSync(OUTPUT_APK);
if (!fs.existsSync(OUTPUT_DEB)) fs.mkdirSync(OUTPUT_DEB);

/**
 * Get the cache path for a repository
 * @typedef {({"version": string, "repository": string, "architecture": string})} indexSpecifier
 * @param {indexSpecifier} param0
 */
function cachePathFor({ version, repository, architecture }) {
  return path.join(CACHE, version, repository, architecture);
}

/**
 * Generate the alpine linux download cdn url for an index specifier
 * @param {indexSpecifier} param0 
 * @returns {string} The alpine linux download cdn url for the specifier
 */
function repoUrlFor({ version, repository, architecture }) {
  return `https://dl-cdn.alpinelinux.org/alpine/${version}/${repository}/${architecture}`;
}

/**
 * Pump, but promisified
 * @param  {...pump.Stream} stream
 */
function pumpPromise(...streams) {
  return new Promise((resolve, reject) =>
    pump(...streams, function (err) {
      if (err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    }),
  );
}

/**
 * Get the apk index for an apk repository
 * @param {indexSpecifier} index
 */
async function fetchIndex(index) {
  const url = repoUrlFor(index) + "/APKINDEX.tar.gz";

  const res = await getPromise(url);

  const gunzip = zlib.createGunzip();

  const untar = tar.extract(cachePathFor(index));

  await pumpPromise(res, gunzip, untar);

  log("verbose", "Fetched index");
}

/**
 * Get apk indexes joined together
 * @returns
 */
async function joinedIndexes(indexes = REPOS) {
  const parsed = await Promise.all(indexes.map((index) => parseIndex(index)));
  // Flatten to join the items together
  return parsed.flat(1);
}

/**
 * Update *all* of the apk indexes
 */
async function updateIndexes() {
  for (const repo of REPOS) {
    log("verbose",
      `Fetching index from alpine linux ${repo.version}@${repo.repository} for ${repo.architecture}`,
    );
    await fetchIndex(repo);
  }

  log("log", "All indexes updated.");
}

/**
 * Parse the apk indexes
 * @typedef {({name: string; version: string; deps: string[]; arch: string; size: string; repo: indexSpecifier})} ApkPackage
 * @param {indexSpecifier} index
 * @returns {Promise<ApkPackage[]>}
 */
async function parseIndex(index) {
  const cachePath = path.join(cachePathFor(index), "APKINDEX");
  let content;
  if (fs.existsSync(cachePath)) {
    content = fs.readFileSync(cachePath, "utf8");
  } else {
    await fetchIndex(index);
    content = fs.readFileSync(cachePath, "utf8");
  }
  const packages = [];

  let pkg = {};

  for (const line of content.split("\n")) {
    if (line === "") {
      packages.push(pkg);
      pkg = {};
      continue;
    }

    const key = line[0];
    const value = line.slice(2);

    switch (key) {
      case "P":
        pkg.name = value;
        break;
      case "V":
        pkg.version = value;
        break;
      case "D":
        pkg.deps = value.split(" ");
        break;
      case "A":
        pkg.arch = value;
        break;
      case "S":
        pkg.size = value;
        break;
    }
  }

  return packages
    .filter((v) => Object.keys(v).length !== 0)
    .map((v) => ({ ...v, repo: index }));
}

/**
 * Search the apk indexes like this *search*
 * @param {string} term
 * @returns The packages matching your search
 */
async function searchPackages(term) {
  const pkgs = await joinedIndexes();

  return pkgs.filter((p) => p.name.includes(term));
}

/**
 * Download the apk package.
 * @param {ApkPackage} pkg The package to download
 */
async function downloadPackage(pkg, allowDownloading = true) {
  const file = `${pkg.name}-${pkg.version}.apk`;

  const outputFile = path.join(OUTPUT_APK, file);

  if (!fs.existsSync(outputFile)) {
    if (!allowDownloading) {
      throw new Error(
        "Did not find package in cache, and downloading is not allowed!",
      );
    }
    const url = `${repoUrlFor(pkg.repo)}/${file}`;

    const request = await getPromise(url);

    await pumpPromise(request, fs.createWriteStream(outputFile));
  }

  return outputFile;
}

/**
 * Get the apk packages of a package by its name and all of its dependencies
 * @param {string} pkgName The name of the package
 * @returns {Promise<ApkPackage[]>} The package and its dependencies
 */
async function getPackageAndDeps(pkgName) {
  const pkgs = await joinedIndexes();
  const map = Object.fromEntries(pkgs.map((p) => [p.name, p]));

  const visited = new Set();

  function resolve(name) {
    if (visited.has(name)) return;
    visited.add(name);

    const pkg = map[name];

    if (!pkg) return;

    if (pkg.deps) {
      for (const dep of pkg.deps) {
        const depName = dep.split(/[<>=]/)[0];
        resolve(depName);
      }
    }
  }

  resolve(pkgName);

  return Array.from(visited)
    .map((v) => map[v])
    .filter((v) => v !== undefined);
}

/**
 * Download a package with its deps
 * @param {string} pkgName
 */
async function fetchWithDeps(pkgName) {
  const pkgs = await getPackageAndDeps(pkgName);
  for (const pkg of pkgs) {
    await downloadPackage(pkg);
  }
  return pkgs;
}

/**
 * Parse an alpine linux package info
 * @param {string} packageInfo
 * @returns {{[key: string]: string}}
 */
function parsePackageInfo(packageInfo) {
  const lines = packageInfo.split("\n");
  // We are on single lines, so this works, consumes all chars including and after the first # per line
  const noCommentsLines = lines.map((value) => value.replace(/#.*/, ""));
  const trimmedLines = noCommentsLines.map((value) => value.trim());
  // I assume that you should split at the first = and ignore the rest of them
  const splitLines = trimmedLines.map((value) => {
    const [key, ...rest] = value.split("=");
    return [key, rest.join("=")];
  });
  const trimmedSplitLines = splitLines.map((values) =>
    values.map((v) => v.trim()),
  );
  return Object.fromEntries(trimmedSplitLines);
}

program.command("update").action(async () => {
  await updateIndexes();
});

program.command("search <term>").action(async (term) => {
  const results = await searchPackages(term);

  for (const r of results) {
    log("log", `${r.name} ${r.version}`);
  }
});

program
  .command("fetch <pkg>")
  .option("--deps")
  .option("--debfile")
  .action(async (pkg, options) => {
    const packages = [];
    if (options.deps) {
      packages.push(...(await fetchWithDeps(pkg)));
    } else {
      const pkgs = await joinedIndexes();
      const p = pkgs.find((x) => x.name === pkg);

      if (!p) throw new Error("Package not found");

      await downloadPackage(p);
      packages.push(p);
    }

    for (const pkgInfo of packages) {
      const path = await downloadPackage(pkgInfo, false);
      log("log", "Apk package file: " + path);
    }

    if (options.debfile) {
      for (const pkgInfo of packages) {
        const outputDebPath = path.join(
          OUTPUT_DEB,
          `${pkgInfo.name}-${pkgInfo.version}-alpine.deb`,
        );
        if (!fs.existsSync(outputDebPath)) {
          const pkgPath = await downloadPackage(pkgInfo, false);
          const tempPath = fs.mkdtempSync(
            path.join(tmpdir(), pkgInfo.name + "-"),
          );
          function cleanUp() {
            fs.rmSync(tempPath, { recursive: true });
          }
          try {
            fs.cpSync(DEBIAN_REPACKAGE_BASE, tempPath, { recursive: true });

            const pkgRead = fs.createReadStream(pkgPath);
            const gunzip = createGunzip();
            const extract = tar.extract(tempPath, { validateSymlinks: false });

            await pumpPromise(pkgRead, gunzip, extract);

            const packageInfoPath = path.join(tempPath, ".PKGINFO");

            const parsedPackageInfo = parsePackageInfo(
              fs.readFileSync(packageInfoPath).toString(),
            );
            // Convert arch into what debian expects
            parsedPackageInfo.arch =
              alpineNamesToDebianNames[parsedPackageInfo.arch];
            // Setup the debian control file
            const debianControlFile = path.join(tempPath, "DEBIAN", "control");
            let debianControlFileContents = fs
              .readFileSync(debianControlFile)
              .toString();
            const templates = debianControlFileContents.match(/!.*?!/g);
            const replacements = templates.map((value) => [
              value,
              parsedPackageInfo[value.slice(1, -1)],
            ]);
            for (const [value, withValue] of replacements) {
              debianControlFileContents = debianControlFileContents.replaceAll(
                value,
                withValue,
              );
            }
            fs.writeFileSync(debianControlFile, debianControlFileContents);
            // Clean up to remove alpine metadata that debian can't read
            fs.rmSync(packageInfoPath);
            const signaturePaths = fs
              .readdirSync(tempPath)
              .filter((v) => v.startsWith(".SIGN"))
              .map((v) => path.join(tempPath, v));
            for (const signature of signaturePaths) {
              fs.rmSync(signature);
            }

            child_process.spawnSync(
              "dpkg",
              ["--build", tempPath, outputDebPath],
              {
                stdio: "inherit",
              },
            );
          } catch (e) {
            cleanUp();
            throw e;
          }
          cleanUp();
        }

        log("log", "Deb package file: " + outputDebPath);
      }
    }
  });

program.parse(process.argv);
