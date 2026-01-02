import numpy as np
import random

class SimpleGenerator:
    def __init__(self, width, height):
        self.width = width
        self.height = height
    
    def generate(self, difficulty=1):
        """Génère un labyrinthe simple"""
        # Créer grille vide
        maze = np.zeros((self.height, self.width), dtype=int)
        
        # Murs extérieurs
        maze[0, :] = 1
        maze[-1, :] = 1
        maze[:, 0] = 1
        maze[:, -1] = 1
        
        # Obstacles selon difficulté
        num_obstacles = difficulty * 3
        
        for _ in range(num_obstacles):
            if random.choice([True, False]):
                # Mur horizontal
                y = random.randint(2, self.height - 3)
                x_start = random.randint(2, self.width - 8)
                length = random.randint(3, 7)
                maze[y, x_start:x_start + length] = random.choice([1, 2, 3])
            else:
                # Mur vertical
                x = random.randint(2, self.width - 3)
                y_start = random.randint(2, self.height - 8)
                length = random.randint(3, 7)
                maze[y_start:y_start + length, x] = random.choice([1, 2, 3])
        
        return maze
    
    def find_valid_positions(self, maze, count):
        """Trouve des positions vides"""
        positions = []
        for y in range(1, self.height - 1):
            for x in range(1, self.width - 1):
                if maze[y, x] == 0:
                    positions.append((x, y))
        
        return random.sample(positions, min(count, len(positions)))