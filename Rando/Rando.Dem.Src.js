
/*******************************************************************************
 * Rando.Dem.Src.js
 * 
 * Dem class : sources file
 * Contains all functions relative to the Dem class
 * 
 * 
 * /!\ Need to be included in html file in this order
 *      <script src="Rando/Rando.Dem.Src.js"></script>
 *      <script src="Rando/Rando.Dem.Hdr.js"></script>
 * 
 ******************************************************************************/

/**
 * RANDO.Dem.buildGround() : build the ground of the DEM 
 */
function buildGround () {
    // Ground building...
    console.log("Ground building... " + (Date.now() - RANDO.START_TIME) );
    var scene = this._scene;
    var center = this._data.center;
    var offsets = this._offsets;
    var tiles = this._tiles;

    // Creates all tiles 
    for (it in tiles) {
        var meshTile = this._buildTile(tiles[it]);
        meshTile.parent = this.ground;
    }

    // Ground built ! 
    console.log("Ground built ! " + (Date.now() - RANDO.START_TIME) );
};


/**
 * RANDO.Dem.buildSides() : build four sides of the DEM
 */
function buildSides () {
    // Sides building...
    console.log("Sides building... " + (Date.now() - RANDO.START_TIME) );
    var tiles  = this._tiles;
    var extent = this._data.extent;
    var scene  = this._scene;
    var sides  = this._sides;
    
    var frame = RANDO.Utils.getFrameFromTiles(tiles);
    var alt_min = extent.altitudes.min - RANDO.SETTINGS.MIN_THICKNESS;

    // Creates differents sides
    var e_side = this._buildSide("East Side",  frame.east,  alt_min, false);
    var w_side = this._buildSide("West Side",  frame.west,  alt_min, true );
    var n_side = this._buildSide("North Side", frame.north, alt_min, false);
    var s_side = this._buildSide("South Side", frame.south, alt_min, true );

    // Set sides container as parent of sides
    e_side.parent = sides;
    w_side.parent = sides;
    n_side.parent = sides;
    s_side.parent = sides;
    
    // Sides built ! 
    console.log("Sides built ! " + (Date.now() - RANDO.START_TIME) );
};


/**
 * RANDO.Dem._buildTile() : build a tile of the DEM
 *      - data : data of a tile 
 *  
 *  return the tile mesh
 */
function _buildTile (data) {
    var scene = this._scene;
    
    // Creates Tile
    var tile = RANDO.Utils.createGroundFromGrid(
        "Tiled Digital Elevation Model - " + it,
        data.grid,
        scene
    );

    // Recomputes normals for lights and shadows
    RANDO.Utils.computeMeshNormals(tile)
    
    // 
    RANDO.Utils.setMeshUvs(tile, data.uv);
    
    // Enables collisions
    tile.checkCollisions = true;
    
    // Get url of the texture
    var url = RANDO.Utils.replaceUrlCoordinates(
        RANDO.SETTINGS.TILE_TEX_URL,
        data.coordinates.z, 
        data.coordinates.x, 
        data.coordinates.y
    );
    
    // Material & Texture
    var material =  new BABYLON.StandardMaterial("DEM Material - " + it, scene);
    var texture = new BABYLON.Texture(
        url,
        scene
    );
    material.diffuseTexture = texture;
    material.backFaceCulling = false;
    tile.material = material;

    return tile;
};


/**
 * RANDO.Dem._buildSide() : build a side of the DEM
 *      - name: name of the side 
 *      - line: Array of point 
 *      - alt_min: altitude minimale of the DEM
 *      - reverse: boolean ->if true reverse the line
 * 
 *  return the side mesh 
 */
function _buildSide (name, line, alt_min, reverse) {
    var scene = this._scene;

    if (reverse) {
        line.reverse();
    }

    // Creates side
    var side = RANDO.Utils.createSideFromLine(name, line, alt_min, scene);

    // Side material
    side.material = new BABYLON.StandardMaterial(name + "Material", scene);
    side.material.diffuseTexture = new BABYLON.Texture(RANDO.SETTINGS.SIDE_TEXTURE, scene);

    // Recomputes normals for lights and shadows
    RANDO.Utils.computeMeshNormals(side);

    // Enables collisions
    side.checkCollisions = true;

    return side;
};


/**
 * RANDO.Dem._generateTiles() : generates an array of tiles which are js objects
 */
function _generateTiles () {
    var extent = this._data.extent;
    var altitudes = this._data.altitudes;
    var offsets = this._offsets;
    var zoom = RANDO.SETTINGS.TILE_ZOOM;
    var tiles = this._tiles;
    
    var grid = RANDO.Utils.createElevationGrid(
        extent.southwest, 
        extent.southeast,
        extent.northeast,
        extent.northwest,
        altitudes
    );

    // Subdivide the elevation grid in tiles 
    RANDO.Utils.subdivideGrid(tiles, grid, zoom);
    
    // At this moment, tiles are not joined at all, so we need to join it 
    RANDO.Utils.joinTiles(tiles);
    
    // Compute tiles uv for future texture mapping 
    RANDO.Utils.computeTilesUvs(tiles);
    
    // Translate the tiles positions of the offsets
    for (var it in tiles) {
        var grid = tiles[it].grid;
        for (row in grid) {
            for (col in grid[row]) {
                grid[row][col].x += offsets.x;
                grid[row][col].y += offsets.y;
                grid[row][col].z += offsets.z;
            }
        }
    }
};


/**
 * RANDO.Dem._initCamera() : set the by default values of camera 
 */
function _initCamera () {
    var scene   = this._scene;
    var center  = this._data.center;
    var offsets = this._offsets
    
    scene.activeCamera.rotation = new BABYLON.Vector3(0.6, 1, 0);
    scene.activeCamera.position = new BABYLON.Vector3(
        center.x + offsets.x - 2000, 
        center.y + offsets.y + 2500, 
        center.z + offsets.z - 1500
    );
};



