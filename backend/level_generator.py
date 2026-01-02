import numpy as np
import random
import json
from typing import List, Dict, Tuple
from collections import deque

class LevelGenerator:
    """
    Générateur de niveaux pour PathMind
    Supporte les boxes multi-cellules et les cristaux
    """
    
    # Types de cellules
    EMPTY = 0
    BOX_SMALL = 1    # 1x1
    BOX_2X1 = 2      # 2x1 (horizontal)
    BOX_2X2 = 3      # 2x2
    CRYSTAL_GOLD = 4 # Leaderboard
    CRYSTAL_ICY = 5  # Obligatoire
    CRYSTAL_RED = 6  # Malus -3s
    
    def __init__(self, grid_size: int = 15):
        self.grid_size = grid_size
    
    def generate_level(self, difficulty: int = 1) -> Dict:
        """
        Générer un niveau avec une difficulté donnée (1-10)
        """
        # Ajuster la taille selon la difficulté
        size = min(self.grid_size + difficulty, 25)
        
        # Créer une grille vide
        grid = np.zeros((size, size), dtype=int)
        
        # Paramètres selon difficulté
        num_obstacles = int(5 + difficulty * 3)
        num_icy = min(1 + difficulty // 2, 5)
        num_gold = random.randint(1, 3)
        num_red = random.randint(0, min(difficulty // 3, 3))
        time_limit = max(15, 45 - difficulty * 2)
        
        # Placer les obstacles
        self._place_obstacles(grid, num_obstacles)
        
        # Trouver les positions valides pour joueur et goal
        valid_positions = self._find_valid_positions(grid)
        
        if len(valid_positions) < 2:
            # Fallback: régénérer
            return self.generate_level(difficulty)
        
        # Choisir des positions éloignées pour le joueur et le goal
        player_pos, goal_pos = self._choose_distant_positions(valid_positions, size)
        
        # Vérifier qu'un chemin existe
        if not self._path_exists(grid, player_pos, goal_pos):
            return self.generate_level(difficulty)
        
        # Placer les cristaux
        crystals_icy = self._place_crystals(grid, CRYSTAL_ICY=5, count=num_icy, 
                                             exclude=[player_pos, goal_pos])
        crystals_gold = self._place_crystals(grid, CRYSTAL_ICY=4, count=num_gold,
                                              exclude=[player_pos, goal_pos])
        crystals_red = self._place_crystals(grid, CRYSTAL_ICY=6, count=num_red,
                                             exclude=[player_pos, goal_pos])
        
        # Vérifier que tous les cristaux icy sont accessibles
        all_icy_accessible = all(
            self._path_exists(grid, player_pos, pos, ignore_crystals=True)
            for pos in crystals_icy
        )
        
        if not all_icy_accessible:
            return self.generate_level(difficulty)
        
        return {
            "level": 1,
            "difficulty": difficulty,
            "grid": grid.tolist(),
            "player_pos": list(player_pos),
            "goal_pos": list(goal_pos),
            "time_limit": time_limit,
            "total_icy": len(crystals_icy),
            "crystals_icy": [list(p) for p in crystals_icy],
            "crystals_gold": [list(p) for p in crystals_gold],
            "crystals_red": [list(p) for p in crystals_red],
            "grid_size": size
        }
    
    def _place_obstacles(self, grid: np.ndarray, count: int):
        """Placer des obstacles de différentes tailles"""
        size = grid.shape[0]
        placed = 0
        attempts = 0
        max_attempts = count * 20
        
        while placed < count and attempts < max_attempts:
            attempts += 1
            
            # Choisir un type d'obstacle aléatoire
            obstacle_type = random.choices(
                [self.BOX_SMALL, self.BOX_2X1, self.BOX_2X2],
                weights=[0.5, 0.3, 0.2]
            )[0]
            
            # Position aléatoire
            x = random.randint(1, size - 3)
            y = random.randint(1, size - 3)
            
            if obstacle_type == self.BOX_SMALL:
                if grid[y][x] == 0:
                    grid[y][x] = self.BOX_SMALL
                    placed += 1
                    
            elif obstacle_type == self.BOX_2X1:
                if x + 1 < size and grid[y][x] == 0 and grid[y][x+1] == 0:
                    grid[y][x] = self.BOX_2X1      # Coin gauche = 2
                    grid[y][x+1] = -2               # Marqueur
                    placed += 1
                    
            elif obstacle_type == self.BOX_2X2:
                if (x + 1 < size and y + 1 < size and
                    grid[y][x] == 0 and grid[y][x+1] == 0 and
                    grid[y+1][x] == 0 and grid[y+1][x+1] == 0):
                    grid[y][x] = self.BOX_2X2          # Coin supérieur gauche = 3
                    grid[y][x+1] = -3                   # Marqueur (partie de la box)
                    grid[y+1][x] = -3                   # Marqueur
                    grid[y+1][x+1] = -3                 # Marqueur
                    placed += 1
    
    def _find_valid_positions(self, grid: np.ndarray) -> List[Tuple[int, int]]:
        """Trouver toutes les positions valides (cellules vides)"""
        valid = []
        for y in range(grid.shape[0]):
            for x in range(grid.shape[1]):
                if grid[y][x] == 0:
                    valid.append((x, y))
        return valid
    
    def _choose_distant_positions(self, positions: List[Tuple], size: int) -> Tuple:
        """Choisir deux positions éloignées l'une de l'autre"""
        if len(positions) < 2:
            return positions[0], positions[0]
        
        # Essayer de placer le joueur dans un coin et le goal dans le coin opposé
        corners = [
            (1, 1),
            (1, size - 2),
            (size - 2, 1),
            (size - 2, size - 2)
        ]
        
        random.shuffle(corners)
        
        player_pos = None
        goal_pos = None
        
        for corner in corners:
            if corner in positions:
                if player_pos is None:
                    player_pos = corner
                elif goal_pos is None:
                    # Vérifier que c'est assez loin
                    dist = abs(corner[0] - player_pos[0]) + abs(corner[1] - player_pos[1])
                    if dist > size // 2:
                        goal_pos = corner
                        break
        
        # Fallback: positions aléatoires
        if player_pos is None:
            player_pos = random.choice(positions)
        if goal_pos is None:
            remaining = [p for p in positions if p != player_pos]
            if remaining:
                # Choisir la position la plus éloignée
                goal_pos = max(remaining, key=lambda p: 
                    abs(p[0] - player_pos[0]) + abs(p[1] - player_pos[1]))
            else:
                goal_pos = player_pos
        
        return player_pos, goal_pos
    
    def _path_exists(self, grid: np.ndarray, start: Tuple, end: Tuple, 
                     ignore_crystals: bool = False) -> bool:
        """Vérifier si un chemin existe entre deux points (BFS)"""
        if start == end:
            return True
        
        size = grid.shape[0]
        visited = set()
        queue = deque([start])
        visited.add(start)
        
        while queue:
            x, y = queue.popleft()
            
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                nx, ny = x + dx, y + dy
                
                if (0 <= nx < size and 0 <= ny < size and 
                    (nx, ny) not in visited):
                    
                    cell = grid[ny][nx]
                    
                    # Les murs bloquent toujours
                    if cell in [self.BOX_SMALL, self.BOX_2X1, self.BOX_2X2]:
                        continue
                    
                    # Les cristaux ne bloquent pas si ignore_crystals
                    if not ignore_crystals and cell in [self.CRYSTAL_RED]:
                        continue
                    
                    if (nx, ny) == end:
                        return True
                    
                    visited.add((nx, ny))
                    queue.append((nx, ny))
        
        return False
    
    def _place_crystals(self, grid: np.ndarray, CRYSTAL_ICY: int, count: int,
                        exclude: List[Tuple]) -> List[Tuple]:
        """Placer des cristaux sur la grille"""
        placed = []
        valid = self._find_valid_positions(grid)
        valid = [p for p in valid if p not in exclude]
        
        random.shuffle(valid)
        
        for pos in valid[:count]:
            x, y = pos
            grid[y][x] = CRYSTAL_ICY
            placed.append(pos)
        
        return placed
    
    def generate_multiple_levels(self, count: int = 35) -> List[Dict]:
        """Générer plusieurs niveaux avec difficulté croissante"""
        levels = []
        
        for i in range(count):
            # Difficulté progressive
            difficulty = 1 + (i * 9) // (count - 1) if count > 1 else 1
            
            level = self.generate_level(difficulty)
            level["level"] = i + 1
            levels.append(level)
            
            print(f"✅ Niveau {i + 1}/{count} généré (difficulté: {difficulty})")
        
        return levels
    
    def generate_dataset(self, count: int = 3000, output_file: str = "dataset.json") -> List[Dict]:
        """
        Générer un dataset de niveaux pour l'entraînement ML
        Inclut des métriques de difficulté
        """
        dataset = []
        
        for i in range(count):
            difficulty = random.randint(1, 10)
            level = self.generate_level(difficulty)
            
            # Ajouter des features pour le ML
            level["features"] = self._extract_features(level)
            level["dataset_index"] = i
            
            dataset.append(level)
            
            if (i + 1) % 100 == 0:
                print(f"📊 Dataset: {i + 1}/{count} niveaux générés")
        
        # Sauvegarder
        with open(output_file, 'w') as f:
            json.dump(dataset, f, indent=2)
        
        print(f"💾 Dataset sauvegardé: {output_file}")
        return dataset
    
    def _extract_features(self, level: Dict) -> Dict:
        """Extraire les features pour le ML"""
        grid = np.array(level["grid"])
        size = grid.shape[0]
        
        # Compter les obstacles
        num_small = np.sum(grid == self.BOX_SMALL)
        num_2x1 = np.sum(grid == self.BOX_2X1) // 2
        num_2x2 = np.sum(grid == self.BOX_2X2) // 4
        
        # Distance player -> goal
        px, py = level["player_pos"]
        gx, gy = level["goal_pos"]
        manhattan_dist = abs(px - gx) + abs(py - gy)
        
        # Ratio espace libre
        free_space = np.sum(grid == 0) / (size * size)
        
        return {
            "grid_size": size,
            "num_obstacles_small": int(num_small),
            "num_obstacles_2x1": int(num_2x1),
            "num_obstacles_2x2": int(num_2x2),
            "total_obstacles": int(num_small + num_2x1 + num_2x2),
            "num_crystals_icy": level["total_icy"],
            "num_crystals_gold": len(level["crystals_gold"]),
            "num_crystals_red": len(level["crystals_red"]),
            "time_limit": level["time_limit"],
            "manhattan_distance": manhattan_dist,
            "free_space_ratio": round(free_space, 3),
            "difficulty": level["difficulty"]
        }
    
    def save_levels_to_json(self, levels: List[Dict], filename: str = "levels.json"):
        """Sauvegarder les niveaux dans un fichier JSON"""
        with open(filename, 'w') as f:
            json.dump(levels, f, indent=2)
        print(f"💾 {len(levels)} niveaux sauvegardés dans {filename}")
    
    def load_levels_from_json(self, filename: str = "levels.json") -> List[Dict]:
        """Charger les niveaux depuis un fichier JSON"""
        try:
            with open(filename, 'r') as f:
                levels = json.load(f)
            print(f"📂 {len(levels)} niveaux chargés depuis {filename}")
            return levels
        except FileNotFoundError:
            print(f"❌ Fichier {filename} non trouvé")
            return []


# ===== SIMPLE GENERATOR (Compatibilité) =====
class SimpleGenerator:
    """
    Générateur simple pour compatibilité avec l'ancien code
    """
    def __init__(self, width: int = 15, height: int = 15):
        self.width = width
        self.height = height
        self.level_gen = LevelGenerator(grid_size=max(width, height))
    
    def generate(self, difficulty: int = 1) -> np.ndarray:
        """Générer un labyrinthe simple"""
        level = self.level_gen.generate_level(difficulty)
        return np.array(level["grid"])
    
    def find_valid_positions(self, maze: np.ndarray, count: int = 2) -> List[List[int]]:
        """Trouver des positions valides"""
        valid = []
        for y in range(maze.shape[0]):
            for x in range(maze.shape[1]):
                if maze[y][x] == 0:
                    valid.append([x, y])
        
        random.shuffle(valid)
        return valid[:count]


# ===== TEST =====
if __name__ == "__main__":
    generator = LevelGenerator(grid_size=15)
    
    # Générer un niveau test
    print("🎮 Génération d'un niveau test...")
    level = generator.generate_level(difficulty=5)
    print(f"Taille grille: {level['grid_size']}x{level['grid_size']}")
    print(f"Temps: {level['time_limit']}s")
    print(f"Cristaux Icy: {level['total_icy']}")
    print(f"Cristaux Gold: {len(level['crystals_gold'])}")
    print(f"Cristaux Red: {len(level['crystals_red'])}")
    
    # Afficher la grille
    grid = np.array(level["grid"])
    symbols = {0: '.', 1: '▪', 2: '▬', 3: '■', 4: 'G', 5: 'I', 6: 'R'}
    print("\nGrille:")
    for y in range(grid.shape[0]):
        row = ""
        for x in range(grid.shape[1]):
            if [x, y] == level["player_pos"]:
                row += "P "
            elif [x, y] == level["goal_pos"]:
                row += "X "
            else:
                row += symbols.get(grid[y][x], '?') + " "
        print(row)
    
    # Générer 35 niveaux
    print("\n" + "="*50)
    print("Génération de 35 niveaux...")
    levels = generator.generate_multiple_levels(35)
    generator.save_levels_to_json(levels, "levels.json")
    
    print("\n" + "="*50)
    print("Génération du dataset (100 niveaux pour test)...")
    generator.generate_dataset(100, "dataset_test.json")
