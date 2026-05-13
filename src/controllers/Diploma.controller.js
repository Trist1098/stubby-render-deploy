const friendModel = require('../models/Diploma.model');

module.exports.getDiploma = async function (req, res, next) {
  const user = auth.getUser();
  const diplomaId = user.diploma_id;

  try {
    const diplomas = await diplomaModel.selectDiplomaByDiplomaId(diplomaId);
    res.status(200).json(diplomas);
  } catch (error) {
    console.error('Error getDiploma:', error);
    next(error);
  }
};

module.exports.updateDiploma = async function (req, res, next) {
  const data = {
    diplomaId : req.params.diplomaId,
    userId: user.user_id,
  }

  try {
    const updatedDiploma = await diplomaModel.updateDiplomaByDiplomaId(data);
    res.status(200).json(updatedDiploma);
  } catch (error) {
    console.error('Error updateDiploma:', error);
    next(error);
  }   
};