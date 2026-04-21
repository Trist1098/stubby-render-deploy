const express = require('express');

const router = express.Router();
const {
  createSomething,
  getAllSomethings,
  updateSomething,
  deleteSomething,
} = require('../models/Something.model');

// Create a new something
router.post('/', (req, res, next) => {
  const { name } = req.body;
  createSomething(name)
    .then((something) => res.status(201).json(something))
    .catch(next);
});

// Retrieve all somethings
router.get('/', (req, res, next) => {
  getAllSomethings()
    .then((somethings) => res.status(200).json(somethings))
    .catch(next);
});

// Update a something
router.put('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  updateSomething(id, { name })
    .then((something) => {
      if (!something) {
        return res.status(404).json({ error: 'Something not found' });
      }
      res.status(200).json(something);
    })
    .catch(next);
});

// Delete a something
router.delete('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  deleteSomething(id)
    .then((something) => {
      if (!something) {
        return res.status(404).json({ error: 'Something not found' });
      }
      res.status(200).json(something);
    })
    .catch(next);
});

module.exports = router;
