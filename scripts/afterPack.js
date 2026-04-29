const fs = require('fs');
const path = require('path');
const os = require('os');

const asar = require('@electron/asar');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
}

module.exports = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  if (!appOutDir) return;

  const projectDir = context.packager?.projectDir || process.cwd();
  const resourcesDir = path.join(appOutDir, 'resources');
  const markerPath = path.join(resourcesDir, 'afterPack-call-bind-marker.txt');

  try {
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.writeFileSync(
      markerPath,
      `afterPack ran at ${new Date().toISOString()}\n`
    );
  } catch {
    // ignore marker failures
  }

  const asarPath = path.join(resourcesDir, 'app.asar');
  const asarUnpackedDir = path.join(resourcesDir, 'app.asar.unpacked');

  // Helper: patch a directory that has node_modules layout
  const patchNodeModulesLayout = (rootDir) => {
    const nested = path.join(
      rootDir,
      'node_modules',
      'call-bind',
      'node_modules',
      'call-bind-apply-helpers'
    );
    const topLevel = path.join(rootDir, 'node_modules', 'call-bind-apply-helpers');
    const projectTopLevel = path.join(
      projectDir,
      'node_modules',
      'call-bind-apply-helpers'
    );

    const source = exists(nested) ? nested : projectTopLevel;
    if (!exists(source)) return;

    if (!exists(topLevel)) {
      copyDirRecursive(source, topLevel);
      return;
    }

    fs.rmSync(topLevel, { recursive: true, force: true });
    copyDirRecursive(source, topLevel);
  };

  // Patch unpacked dir if present
  if (exists(asarUnpackedDir)) {
    patchNodeModulesLayout(asarUnpackedDir);
  }

  // Patch app.asar by extracting/re-packing
  if (exists(asarPath)) {
    const tmpRoot = path.join(os.tmpdir(), `nonepos-asar-${Date.now()}`);
    const extractDir = path.join(tmpRoot, 'app');

    fs.mkdirSync(tmpRoot, { recursive: true });

    // Extract app.asar to temp dir
    asar.extractAll(asarPath, extractDir);

    patchNodeModulesLayout(extractDir);

    // Re-pack app.asar
    fs.rmSync(asarPath, { force: true });
    await asar.createPackage(extractDir, asarPath);

    // Cleanup
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
};
