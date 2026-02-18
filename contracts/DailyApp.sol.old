// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMasterX {
    function addPoints(address user, uint256 points, string calldata reason) external;
}

/**
 * @title DailyApp V3
 * @notice Satellite Contract with Pinned Daily Tasks & Sponsorship Groups
 */
contract DailyApp is Ownable {
    
    struct Task {
        string desc;
        uint256 pointReward;
    }

    struct Sponsorship {
        string name;
        uint256[] taskIds;
    }

    IMasterX public masterX;
    uint256 public nextTaskId;
    uint256 public nextSponsorId;

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Sponsorship) public sponsorships;
    mapping(address => mapping(uint256 => bool)) public hasDoneTask;
    
    uint256[] public dailyTaskIds;

    event TaskCreated(uint256 indexed taskId, string desc, uint256 pointReward);
    event SponsorshipCreated(uint256 indexed sponsorId, string name, uint256[] taskIds);
    event TaskCompleted(address indexed user, uint256 indexed taskId, uint256 points);

    constructor(address _masterX) Ownable(msg.sender) {
        require(_masterX != address(0), "Invalid MasterX");
        masterX = IMasterX(_masterX);
        nextTaskId = 1;
        nextSponsorId = 1;
    }

    function createTask(string calldata _desc, uint256 _pointReward) public onlyOwner returns (uint256) {
        uint256 taskId = nextTaskId;
        tasks[taskId] = Task({
            desc: _desc,
            pointReward: _pointReward
        });
        emit TaskCreated(taskId, _desc, _pointReward);
        nextTaskId++;
        return taskId;
    }

    function createDailyTask(string calldata _desc, uint256 _pointReward) external onlyOwner {
        uint256 taskId = createTask(_desc, _pointReward);
        dailyTaskIds.push(taskId);
    }

    function createSponsorship(string calldata _name, string[] calldata _descs, uint256[] calldata _rewards) external onlyOwner {
        require(_descs.length == _rewards.length, "Mismatched arrays");
        require(_descs.length <= 3, "Max 3 tasks per sponsor");

        uint256[] memory taskIds = new uint256[](_descs.length);
        for (uint256 i = 0; i < _descs.length; i++) {
            taskIds[i] = createTask(_descs[i], _rewards[i]);
        }

        sponsorships[nextSponsorId] = Sponsorship({
            name: _name,
            taskIds: taskIds
        });

        emit SponsorshipCreated(nextSponsorId, _name, taskIds);
        nextSponsorId++;
    }

    function doTask(uint256 _taskId) public {
        require(!hasDoneTask[msg.sender][_taskId], "Already completed");
        Task memory task = tasks[_taskId];
        require(bytes(task.desc).length > 0, "Task does not exist");
        
        hasDoneTask[msg.sender][_taskId] = true;
        masterX.addPoints(msg.sender, task.pointReward, task.desc);

        emit TaskCompleted(msg.sender, _taskId, task.pointReward);
    }

    function doBatchTasks(uint256[] calldata _taskIds) external {
        for (uint256 i = 0; i < _taskIds.length; i++) {
            doTask(_taskIds[i]);
        }
    }

    function setMasterX(address _newMasterX) external onlyOwner {
        require(_newMasterX != address(0), "Invalid address");
        masterX = IMasterX(_newMasterX);
    }
    
    function getSponsorTasks(uint256 _sponsorId) external view returns (uint256[] memory) {
        return sponsorships[_sponsorId].taskIds;
    }

    function getDailyTasks() external view returns (uint256[] memory) {
        return dailyTaskIds;
    }
}
