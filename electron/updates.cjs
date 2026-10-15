class DesktopUpdates {
  constructor({ updater, dialog, getWindow, stopServices, packaged, version, notify = () => {} }) {
    Object.assign(this, { updater, dialog, getWindow, stopServices, packaged, version, notify });
    this.downloaded = false;
    this.checking = false;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.on('error', error => this.notify(`Update failed: ${error.message}`));
    updater.on('download-progress', progress => { const window = this.getWindow(); if (window) window.setProgressBar(progress.percent / 100); });
    updater.on('update-not-available', () => this.notify(`Version ${this.version} is up to date.`));
    updater.on('update-available', async info => {
      const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : (info.releaseNotes || []).map(note => note.note).join('\n');
      const choice = await this.dialog.showMessageBox(this.getWindow(), { type: 'info', title: 'Update available', message: `Visitor Counter ${info.version}`, detail: notes.replace(/<[^>]*>/g, '').slice(0, 5000), buttons: ['Download update', 'Later'], defaultId: 0, cancelId: 1 });
      if (choice.response === 0) await updater.downloadUpdate().catch(error => this.notify(`Download failed: ${error.message}`));
    });
    updater.on('update-downloaded', async () => {
      this.downloaded = true;
      this.getWindow()?.setProgressBar(-1);
      const choice = await this.dialog.showMessageBox(this.getWindow(), { type: 'info', title: 'Update ready', message: 'Restart to install the downloaded update?', buttons: ['Restart and install', 'Later'], defaultId: 0, cancelId: 1 });
      if (choice.response === 0) await this.install();
    });
  }
  async check() {
    if (!this.packaged) return this.notify('Updates are available in signed, installed release builds.');
    if (this.checking) return;
    this.checking = true;
    try { await this.updater.checkForUpdates(); } catch (error) { this.notify(`Update check failed: ${error.message}`); }
    finally { this.checking = false; }
  }
  async install() {
    if (!this.downloaded) return this.notify('No downloaded update is ready.');
    await this.stopServices();
    this.updater.quitAndInstall(false, true);
  }
}
module.exports = { DesktopUpdates };
