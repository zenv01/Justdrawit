// AI Predictor logic for Solo AI Mode
const Word = require('../models/Word');

class AIPredictor {
  constructor() {
    this.dictionary = [
      'Apple', 'Cat', 'House', 'Car', 'Tree', 'Sun', 'Pizza',
      'Airplane', 'Elephant', 'Bicycle', 'Guitar', 'Computer',
      'Eiffel Tower', 'Astronaut', 'Helicopter', 'Submarine', 'Dragon',
      'Rainbow', 'Clock', 'Basketball'
    ];

    // Predefined AI stroke sequences for AI-as-Drawer mode
    this.presetDrawings = {
      'Apple': [
        { type: 'circle', x: 250, y: 250, radius: 80, color: '#fe0000' },
        { type: 'line', x1: 250, y1: 170, x2: 260, y2: 130, color: '#8b4513' },
        { type: 'path', points: [{x: 260, y: 145}, {x: 290, y: 135}, {x: 275, y: 155}], color: '#00b050' }
      ],
      'Sun': [
        { type: 'circle', x: 250, y: 250, radius: 60, color: '#ffde00' },
        { type: 'line', x1: 250, y1: 160, x2: 250, y2: 120, color: '#ff7900' },
        { type: 'line', x1: 250, y1: 340, x2: 250, y2: 380, color: '#ff7900' },
        { type: 'line', x1: 160, y1: 250, x2: 120, y2: 250, color: '#ff7900' },
        { type: 'line', x1: 340, y1: 250, x2: 380, y2: 250, color: '#ff7900' }
      ],
      'House': [
        { type: 'rect', x: 170, y: 220, width: 160, height: 140, color: '#8b4513' },
        { type: 'polygon', points: [{x: 150, y: 220}, {x: 250, y: 130}, {x: 350, y: 220}], color: '#fe0000' },
        { type: 'rect', x: 225, y: 280, width: 50, height: 80, color: '#002060' }
      ]
    };
  }

  /**
   * Evaluates user stroke data against target word or returns confidence scores.
   * @param {string} targetWord 
   * @param {Array} drawEvents 
   */
  predictUserDrawing(targetWord, drawEvents = []) {
    if (!drawEvents || drawEvents.length === 0) {
      return {
        guess: 'Nothing yet',
        confidence: 0,
        isCorrect: false
      };
    }

    const strokeCount = drawEvents.length;
    // Calculate pseudo-confidence based on stroke count and drawing progression
    const confidence = Math.min(98, Math.floor(15 + strokeCount * 4 + Math.random() * 10));

    // When strokes are sufficient, check if target word matches or return high confidence
    const isCorrect = strokeCount > 6 || (strokeCount > 3 && Math.random() > 0.3);
    const guessedWord = isCorrect ? targetWord : this.dictionary[Math.floor(Math.random() * this.dictionary.length)];

    return {
      guess: guessedWord,
      confidence: confidence,
      isCorrect: guessedWord.toLowerCase() === targetWord.toLowerCase()
    };
  }

  /**
   * Get stroke sequence for AI drawing
   */
  getAIDrawingStrokes(word) {
    return this.presetDrawings[word] || [
      { type: 'circle', x: 250, y: 250, radius: 70, color: '#000000' },
      { type: 'line', x1: 200, y1: 200, x2: 300, y2: 300, color: '#000000' }
    ];
  }
}

module.exports = new AIPredictor();
