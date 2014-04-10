// Rando.Builds.js 
// Builders of zone and route

var RANDO = RANDO || {};
RANDO.Builds = {};
  
/**
 * 
 * 
 * 
 * 
 * 
 */
RANDO.Builds.launch = function(canvas){
    // Check support
    if (!BABYLON.Engine.isSupported()) {
        window.alert('Browser not supported');
        return null;
        
    } else {
        window.addEventListener("resize", function(){
            engine.resize();
        });
        // Load BABYLON 3D engine
        var engine = new BABYLON.Engine(canvas, true);
        
        // Creation of the scene 
        var scene = new BABYLON.Scene(engine);
        
        // Camera
        var camera = RANDO.Builds.Camera(scene);
        
        // Lights
        var lights = RANDO.Builds.Lights(scene);
        
        var grid2D, translateXY = {
            x : 0,
            y : 0
        };
        
        $.getJSON(RANDO.SETTINGS.DEM_URL)
         .done(function (data) {
            var m_extent = RANDO.Utils.getExtentinMeters(data.extent);
            var m_center = RANDO.Utils.toMeters(data.center);

            // DEM
            var dem = {
                "extent"    :   m_extent,
                "altitudes"  :  data.altitudes, // altitudes already in meters
                "resolution":   data.resolution,// reso already in meters
                "center"    :   {
                                    x: m_center.x,
                                    y: data.center.z,// alt of center already in meters
                                    z: m_center.y
                                }
            };
            
            // Control if altitudes data coincide with resolution data
            console.assert(dem.altitudes.length == dem.resolution.y);
            console.assert(dem.altitudes[0].length == dem.resolution.x);

            console.log(dem);
            
            // Translation of the DEM
            translateXY.x = -dem.center.x;
            translateXY.y = -dem.center.z;
            RANDO.Utils.translateDEM(
                dem,
                translateXY.x,
                dem.extent.altitudes.min,
                translateXY.y
            );

            // DEM mesh building
            RANDO.Builds.DEM(
                dem,
                scene
            );
            
            
            // Tiled DEM mesh building
            RANDO.Builds.TiledDEM(
                dem,
                scene
            );
         })
        .then(function () {
            return $.getJSON(RANDO.SETTINGS.PROFILE_URL);
        })
        .done(function (data) {
            var vertices = RANDO.Utils.getVerticesFromProfile(data.profile);
            
            // Translation of the route to make it visible
            RANDO.Utils.translateRoute(
                vertices,
                translateXY.x,
                0,
                translateXY.y
            );

            // Drape the route over the DEM
            RANDO.Utils.drape(vertices, scene);

            // Route just a bit higher to the DEM
            RANDO.Utils.translateRoute(
                vertices,
                0,
                RANDO.SETTINGS.TREK_OFFSET,
                0
            );
            
            // Route building
            RANDO.Builds.Trek(scene, vertices);
        });

        scene.activeCamera.attachControl(canvas);
            
        // Once the scene is loaded, just register a render loop to render it
        engine.runRenderLoop(function () {
            //RANDO.Utils.refreshPanels(vertices.length, scene);
            scene.render();
        });
        
        scene.executeWhenReady(function () {
            console.log("Scene is ready ! " + (Date.now() - START_TIME) );
            // texture
            if(scene.getMeshByName("Digital Elevation Model") && RANDO.SETTINGS.TEXTURE_URL){
                var material = scene.getMeshByName("Digital Elevation Model").material;
                material.diffuseTexture =  new BABYLON.Texture(
                    RANDO.SETTINGS.TEXTURE_URL, 
                    scene
                );
                material.wireframe = false;
            }
            
            //~ $("#loader").switchClass("loading", "unloading", 200, "easeOutQuad" );
            //~ $("#loader").switchClass("unloading", "endloading", 200);
        });
        return scene;
    }
}

/**
 * zone() : build a heightMap from a DEM corresponding of zone around a troncon 
 *      - scene (BABYLON.Scene) : current scene
 *      - data (Dictionnary)    : dictionnary containing :
 *              * center of DEM
 *              * resolution of DEM
 *              * vertices  
 *      - texture (BABYLON.Texture) : texture which will be applied  **optionnal**
 *      - cam_b (Boolean)       : settings of camera **optionnal**
 * 
 */
RANDO.Builds.DEM = function(data, scene, cam_b){
    if(typeof(cam_b)==='undefined') cam_b = true;
    
    // DEM building...
    console.log("DEM building... " + (Date.now() - START_TIME) );
    
    var center = data.center;
    var resolution = data.resolution;
    var altitudes = data.altitudes;
    
    // Camera 
    if (cam_b){
        scene.activeCamera.rotation = new BABYLON.Vector3(0.6, 1, 0);
        scene.activeCamera.position = new BABYLON.Vector3(
            center.x-2000, 
            center.y+500, 
            center.z-1500
        );
    }
    
    // Material
    var material =  new BABYLON.StandardMaterial("GroundMaterial", scene);
    material.backFaceCulling = false;
    material.wireframe = true;
    
    
    console.log(data.extent);
    // Create DEM
    var dem = RANDO.Utils.createGroundFromExtent(
        "Digital Elevation Model",
        data.extent.southwest,
        data.extent.southeast,
        data.extent.northeast,
        data.extent.northwest,
        resolution.x-1,
        resolution.y-1, 
        scene
    );
    dem.material = material;
    
    
    
    // Put elevations in the DEM
    var vertices = dem.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    var i = 1;
    for (row in altitudes){
        for (col in altitudes[row]){
            vertices[i] = altitudes[row][col];
            i+=3;
        }
    }
    dem.setVerticesData(vertices, BABYLON.VertexBuffer.PositionKind);
    
    // DEM built ! 
    console.log("DEM built ! " + (Date.now() - START_TIME) );
}

RANDO.Builds.TiledDEM = function(data, scene, cam_b){
    if(typeof(cam_b)==='undefined') cam_b = true;
    
    // Tiled DEM building...
    console.log("Tiled DEM building... " + (Date.now() - START_TIME) );
    
    var center = data.center;
    var resolution = data.resolution;
    var altitudes = data.altitudes;
    var extent = data.extent;
    
    // Camera 
    if (cam_b){
        scene.activeCamera.rotation = new BABYLON.Vector3(0.6, 1, 0);
        scene.activeCamera.position = new BABYLON.Vector3(
            center.x-2000, 
            center.y+500, 
            center.z-1500
        );
    }
    
    /////////////////////////////////////////////////////
    //// To loop ////////////////////////////////////////
    // Generate grid from extent datas
    var grid = RANDO.Utils.createGrid(
        data.extent.southwest,
        data.extent.southeast,
        data.extent.northeast,
        data.extent.northwest,
        resolution.x,
        resolution.y
    );
    
    // Give altitudes to the grid 
    for (row in altitudes){
        for (col in altitudes[row]){
            grid[row][col].z = altitudes[row][col];
        }
    }
    
    var sub_grid = RANDO.Utils.subdivideGrid(grid, 1);
    
    // Material
    var material =  new BABYLON.StandardMaterial("GroundMaterial", scene);
    material.backFaceCulling = false;
    material.wireframe = true;
    for (it in sub_grid) {
        // Create DEM
        var dem = RANDO.Utils.createGroundFromVertices(
            "Tiled Digital Elevation Model",
            sub_grid[it].vertices,
            sub_grid[it].resolution.x -1,
            sub_grid[it].resolution.y -1,
            scene
        );
        dem.material = material;
    }
    
    //// End of loop ////////////////////////////////////////
    /////////////////////////////////////////////////////
    
    // DEM built ! 
    console.log("Tiled DEM built ! " + (Date.now() - START_TIME) );
}

/**
* route() : build a troncon from an array of point
*       - scene (BABYLON.Scene) : current scene
*       - vertices : array of vertices
*       - cam_b (bool): settings of camera **optionnal**
*       - lin_b (bool): using of "line" meshes (kind of ribbon) **optionnal**
*       - sph_b (bool): using of sphere meshes **optionnal**
*       - cyl_b (bool): using of cylinder meshes **optionnal**
*       - pan_b (bool): using of panel meshes to display informations **optionnal**
*/
RANDO.Builds.Trek = function(scene, vertices, sph_b, cyl_b, pan_b ){
    if(typeof(sph_b)==='undefined') sph_b = true;
    if(typeof(cyl_b)==='undefined') cyl_b = true;
    if(typeof(pan_b)==='undefined') pan_b = false;
    
    RANDO.Utils.animateCamera(vertices, scene);
    
    // Trek building ...
    console.log("Trek building... " + (Date.now() - START_TIME) );
    var trek = new BABYLON.Mesh("Trek", scene);
    
    // Trek material
    var trek_material = new BABYLON.StandardMaterial("Trek Material", scene);
    trek_material.diffuseColor = RANDO.SETTINGS.TREK_COLOR;
    
    // With Cylinder meshes
    if (cyl_b){
        var cyl_diameter = RANDO.SETTINGS.TREK_WIDTH;
        var cyl_tessel = 10;
        
        for (var i = 0; i < vertices.length-1; i++){
            var A = new BABYLON.Vector3(
                vertices[i].x,
                vertices[i].y,
                vertices[i].z
            );
            var B = new BABYLON.Vector3(
                vertices[i+1].x,
                vertices[i+1].y,
                vertices[i+1].z
            );
            var cyl_height = BABYLON.Vector3.Distance(A,B);
            
            // Create Cylinder
            var cylinder = BABYLON.Mesh.CreateCylinder(
                "Cylinder " + (i+1),
                cyl_height,
                cyl_diameter,
                cyl_diameter,
                cyl_tessel,
                scene
            );
            
            // Place the cylinder between the current point A and the next point B
            cylinder = RANDO.Utils.placeCylinder(cylinder, A, B);
            
            // Apply material
            cylinder.material = trek_material;
            
            cylinder.parent = trek;
        }
    }//------------------------------------------------------------------
    
    // Spheres for each point
    if (sph_b){
        var sph_diam = RANDO.SETTINGS.TREK_WIDTH;

        for(it in vertices){
            // Create Sphere
            var sphere = BABYLON.Mesh.CreateSphere("Sphere " + it, 5, sph_diam, scene);
            sphere.position = new BABYLON.Vector3(
                vertices[it].x,
                vertices[it].y,
                vertices[it].z
            );
            
            // Apply material
            sphere.material = trek_material;
            
            sphere.parent = trek;
        }
    }//------------------------------------------------------------------
    
    // Panel for each point which indicates infos about point
    if (pan_b){
        // Create Panel
        var pan_offset = 3;
        var pan_size = 10;
        var pan_info = {
            'policy' : "bold 50px Arial",
            'color'  : "red"
        };
        var it =0;
        
        var intervalID = window.setInterval(function(){
            var pan_material = new BABYLON.StandardMaterial("Panel" + it, scene);
            pan_material.backFaceSculling = false;
            var panel = BABYLON.Mesh.CreatePlane("Panel" + it, pan_size , scene);
            panel.material = pan_material;
            panel.position = new BABYLON.Vector3(
                vertices[it].x,
                vertices[it].y,
                vertices[it].z
            );
            
            var texture = new BABYLON.DynamicTexture("dynamic texture" +it, 512, scene, true);
            panel.material.diffuseTexture = texture;
            texture.hasAlpha = true;
            texture.drawText("Point "+ it+ " : "+ vertices[it].y +" m",
                50, 100, pan_info.policy, pan_info.color,
                null
            );
            
            if(it < vertices.length-1)
                it++;
            else
                window.clearInterval(intervalID);
        }, 1);
        
    }//------------------------------------------------------------------
    
    // Trek built !
    console.log("Trek built ! " + (Date.now() - START_TIME) );
}

/**
 * cardinals() : build the NW, NE, SE and SW extrems points of the DEM with spheres
 * 
 *      - extent : contain the four corners of the DEM
 *      - scene  : current scene  
 * 
 * NB : each point have its own color
 *          NW --> White 
 *          NE --> Red
 *          SE --> Blue
 *          SW --> Green
 * 
 */
RANDO.Builds.Cardinals = function(extent, scene){

    var tmp;
    var sph_diam = 20;
    var matA = new BABYLON.StandardMaterial("SphereMaterial", scene);
    var A = BABYLON.Mesh.CreateSphere("SphereA", 5, sph_diam, scene);
    tmp = extent.northwest;
    A.position.x = tmp.x;
    A.position.y = 1500;
    A.position.z = tmp.y;
    matA.diffuseColor = new BABYLON.Color3(255,255,255);
    A.material = matA;
    
    var matB = new BABYLON.StandardMaterial("SphereMaterial", scene);
    var B = BABYLON.Mesh.CreateSphere("SphereB", 5, sph_diam, scene);
    tmp = extent.northeast;
    B.position.x = tmp.x;
    B.position.y = 1500;
    B.position.z = tmp.y;
    matB.diffuseColor = new BABYLON.Color3(255,0,0);
    B.material = matB;
    
    var matC = new BABYLON.StandardMaterial("SphereMaterial", scene);
    var C = BABYLON.Mesh.CreateSphere("SphereC", 5, sph_diam, scene);
    tmp = extent.southeast;
    C.position.x = tmp.x;
    C.position.y = 1500;
    C.position.z = tmp.y;
    matC.diffuseColor = new BABYLON.Color3(0,0,255);
    C.material = matC;
    
    var matD = new BABYLON.StandardMaterial("SphereMaterial", scene);
    var D = BABYLON.Mesh.CreateSphere("SphereD", 5, sph_diam, scene);
    tmp = extent.southwest;
    D.position.x = tmp.x;
    D.position.y = 1500;
    D.position.z = tmp.y;
    matD.diffuseColor = new BABYLON.Color3(0,255,0);
    D.material = matD;


}

/**
 *  camera() : initialize main parameters of camera    
 *      - scene : the current scene
 * 
 *  return the camera
 * */
RANDO.Builds.Camera = function(scene){
    var camera  = new BABYLON.FreeCamera("Camera", new BABYLON.Vector3(0, 0, 0), scene);
    camera.checkCollisions = true;
    camera.maxZ = 10000;
    camera.speed = RANDO.SETTINGS.CAM_SPEED_F ;
    camera.keysUp = [90, 38]; // Touche Z
    camera.keysDown = [83, 40]; // Touche S
    camera.keysLeft = [81, 37]; // Touche Q
    camera.keysRight = [68, 39]; // Touche D
    var l_cam = new BABYLON.HemisphericLight("LightCamera", new BABYLON.Vector3(0,1000,0), scene)
    l_cam.intensity = 0.8;
    l_cam.parent = camera;
    return camera;
}

/**
 *  lights() : initialize main parameters of lights    
 *      - scene : the current scene
 * 
 *  return an array containing all lights
 * */
RANDO.Builds.Lights = function(scene){
    var lights = [];
    
    // Sun
    var sun = new BABYLON.HemisphericLight("Sun", new BABYLON.Vector3(500, 2000, 0), scene);
    sun.specular = new BABYLON.Color4(0, 0, 0, 0);
    lights.push(sun);
    return lights;
}
