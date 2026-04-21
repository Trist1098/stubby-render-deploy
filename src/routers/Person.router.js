const express = require('express');
const { getAllPersons } = require('../models/Person.model');
const router = express.Router();

router.get('/', (req, res, next) => {
  getAllPersons()
    .then((persons) => res.status(200).json(persons))
    .catch(next);
});

module.exports = router;
