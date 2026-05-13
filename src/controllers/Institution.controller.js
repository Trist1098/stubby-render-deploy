const friendModel = require('../models/Institution.model');

module.exports.getInstitution = async function (req, res, next) {
  const user = auth.getUser();
  const institutionId = user.institution_id;

  try {
    const institutions = await institutionModel.selectInstitutionByInstitutionId(institutionId);
    res.status(200).json(institutions);
  } catch (error) {
    console.error('Error getInstitution:', error);
    next(error);
  }
};

module.exports.updateInstitution = async function (req, res, next) {
  const data = {
    institutionId : req.params.institutionId,
    userId: user.user_id,
  }

  try {
    const updatedInstitution = await institutionModel.updateInstitutionByInstitutionId(data);
    res.status(200).json(updatedInstitution);
  } catch (error) {
    console.error('Error updateInstitution:', error);
    next(error);
  }   
};