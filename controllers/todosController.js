//TodosController.js
const Todos = require('../models/Todos');

// Create To-Do
exports.createTodo = async (req, res) => {
  try {
    console.log('req.user:', req.user);
    const { title, description, status, dueDate } = req.body;
    const { userId } = req.user; // assuming user info is in req.user

    const todo = new Todos({ userId, title, description, status, dueDate });
    await todo.save();

    res.status(201).json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all To-Dos for logged-in user
exports.getTodos = async (req, res) => {
  try {
    const { userId } = req.user;
    const todos = await Todos.find({ userId }).sort({ dueDate: 1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get To-Do by ID
exports.getTodoById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const todo = await Todos.findOne({ _id: id, userId });
    if (!todo) return res.status(404).json({ message: 'To-Do not found' });
    res.json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update To-Do
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const updates = req.body;
    const todo = await Todos.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
    if (!todo) return res.status(404).json({ message: 'To-Do not found' });
    res.json(todo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete To-Do
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const todo = await Todos.findOneAndDelete({ _id: id, userId });
    if (!todo) return res.status(404).json({ message: 'To-Do not found' });
    res.json({ message: 'To-Do deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};