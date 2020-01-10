module.exports = {
  normalizeEntityName: function() {
  },

  afterInstall: function() {
    return this.addPackageToProject('corber', '^1.4.0');
  }
};
