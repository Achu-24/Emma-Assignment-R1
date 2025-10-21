'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BabyName extends Model {
    static associate(models) {
    }
  }
  BabyName.init({
    name: DataTypes.STRING,
    sex: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'BabyName',
  });
  return BabyName;
};